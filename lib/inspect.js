/**
 * Inspecteur : lit les propriétés d'un fichier (dimensions, durée, nombre de
 * lignes/colonnes, nombre de sous-titres...) sans le modifier. Portage de
 * public/inspect.js (web/desktop/extension) pour le CLI — même répartition par
 * catégorie, mais la durée/résolution audio/vidéo vient de `ffmpeg -i` (parsing de
 * stderr) au lieu des métadonnées natives du navigateur, qui n'existent pas ici.
 */

const fs = require('fs');
const { spawn } = require('child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { bufferToWorkbook } = require('./data');
const { parseSubtitle } = require('./subtitles');
const XLSX = require('xlsx');
const { isHeicBuffer, decodeHeic, isSvgBuffer } = require('./convert');
const { t, getLanguage } = require('./i18n');

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return t('inspect.durationUnknown');
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ffmpeg n'a pas de mode "juste lire les métadonnées, ne rien écrire" : on lui donne
// "-i <fichier>" sans sortie, il échoue volontairement après avoir imprimé les infos du
// flux d'entrée sur stderr (comportement standard, utilisé par ffprobe en interne) — on
// parse cette sortie plutôt que de dépendre d'un binaire ffprobe séparé.
function probeMedia(filePath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ['-i', filePath]);
    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', () => {
      const durationMatch = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr);
      const resolutionMatch = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(stderr);
      if (!durationMatch) {
        return reject(new Error(t('inspect.errMediaUnreadable')));
      }
      const duration =
        parseInt(durationMatch[1], 10) * 3600 + parseInt(durationMatch[2], 10) * 60 + parseFloat(durationMatch[3]);
      resolve({
        duration,
        width: resolutionMatch ? parseInt(resolutionMatch[1], 10) : null,
        height: resolutionMatch ? parseInt(resolutionMatch[2], 10) : null,
      });
    });
  });
}

async function inspectImage(buffer, sourceExt) {
  const items = [];
  if (isSvgBuffer(buffer) || sourceExt === 'svg') {
    const text = buffer.toString('utf8');
    const widthMatch = /width="([\d.]+)/.exec(text);
    const heightMatch = /height="([\d.]+)/.exec(text);
    const viewBoxMatch = /viewBox="([^"]+)"/.exec(text);
    if (widthMatch && heightMatch) items.push({ label: t('inspect.declaredDimensions'), value: `${widthMatch[1]} × ${heightMatch[1]}` });
    if (viewBoxMatch) items.push({ label: 'viewBox', value: viewBoxMatch[1] });
    items.push({ label: t('inspect.type'), value: t('inspect.typeVector') });
    return items;
  }

  const sourceBuffer = isHeicBuffer(buffer) ? await decodeHeic(buffer) : buffer;
  const meta = await sharp(sourceBuffer).metadata();
  items.push({ label: t('inspect.dimensions'), value: `${meta.width} × ${meta.height} px` });
  items.push({ label: t('inspect.ratio'), value: (meta.width / meta.height).toFixed(3) });
  items.push({ label: t('inspect.format'), value: meta.format });
  if (isHeicBuffer(buffer)) items.push({ label: t('inspect.note'), value: t('inspect.heicNote') });
  return items;
}

async function inspectAudioOrVideo(filePath, category) {
  const meta = await probeMedia(filePath);
  const items = [{ label: t('inspect.duration'), value: formatDuration(meta.duration) }];
  if (category === 'video' && meta.width && meta.height) {
    items.push({ label: t('inspect.resolution'), value: `${meta.width} × ${meta.height} px` });
  }
  if (Number.isFinite(meta.duration) && meta.duration > 0) {
    const size = fs.statSync(filePath).size;
    const kbps = Math.round((size * 8) / meta.duration / 1000);
    items.push({ label: t('inspect.avgBitrate'), value: `${kbps} kbps` });
  }
  return items;
}

function inspectData(buffer, sourceExt) {
  const workbook = bufferToWorkbook(buffer, sourceExt);
  const items = [{ label: t('inspect.sheets'), value: workbook.SheetNames.join(', ') }];
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const columnCount = rows.length ? Math.max(...rows.map((r) => r.length)) : 0;
  items.push({ label: t('inspect.rows'), value: String(rows.length) });
  items.push({ label: t('inspect.columns'), value: String(columnCount) });
  if (rows.length) items.push({ label: t('inspect.headers'), value: rows[0].join(', ') });
  return items;
}

function inspectSubtitle(buffer, sourceExt) {
  const cues = parseSubtitle(buffer.toString('utf8'), sourceExt);
  const items = [{ label: t('inspect.subtitleCount'), value: String(cues.length) }];
  if (cues.length) {
    const first = cues[0].start;
    const last = Math.max(...cues.map((c) => c.end));
    items.push({ label: t('inspect.firstTimecode'), value: formatDuration(first) });
    items.push({ label: t('inspect.lastTimecode'), value: formatDuration(last) });
    items.push({ label: t('inspect.coveredRange'), value: formatDuration(last - first) });
  }
  return items;
}

/**
 * Inspecte un fichier et retourne la liste de ses propriétés (label/valeur), en plus des
 * informations génériques communes à tous les fichiers (nom, taille, dernière modification).
 * @param {string} filePath
 * @param {'image'|'data'|'audio'|'video'|'subtitle'} category
 * @param {string} sourceExt
 */
async function inspectFile(filePath, category, sourceExt) {
  const stat = fs.statSync(filePath);
  const generic = [
    { label: t('inspect.name'), value: require('path').basename(filePath) },
    { label: t('inspect.size'), value: formatBytes(stat.size) },
    { label: t('inspect.lastModified'), value: stat.mtime.toLocaleString(getLanguage() === 'en' ? 'en-US' : 'fr-FR') },
  ];

  let specific = [];
  if (category === 'image') specific = await inspectImage(fs.readFileSync(filePath), sourceExt);
  else if (category === 'audio' || category === 'video') specific = await inspectAudioOrVideo(filePath, category);
  else if (category === 'data') specific = inspectData(fs.readFileSync(filePath), sourceExt);
  else if (category === 'subtitle') specific = inspectSubtitle(fs.readFileSync(filePath), sourceExt);

  return [...generic, ...specific];
}

const BYTE_UNITS = { fr: ['o', 'Ko', 'Mo', 'Go'], en: ['B', 'KB', 'MB', 'GB'] };

function formatBytes(bytes) {
  const units = BYTE_UNITS[getLanguage()] || BYTE_UNITS.fr;
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  let value = bytes / 1024;
  let unitIndex = 1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

module.exports = { inspectFile };
