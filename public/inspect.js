/**
 * Inspecteur : lit les propriétés d'un fichier (dimensions, durée, nombre de lignes...)
 * sans le modifier ni produire de fichier de sortie. Volontairement léger : contrairement
 * au Convertisseur/Compresseur, ça n'a pas besoin de charger ffmpeg.wasm — la durée et la
 * résolution audio/vidéo viennent des métadonnées natives du navigateur
 * (`<audio>`/`<video>`, événement `loadedmetadata`), pas d'un décodage complet du fichier.
 */

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return t('inspect.durationUnknown');
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(getLanguage() === 'en' ? 'en-US' : 'fr-FR');
}

// Charge un fichier audio/vidéo dans un élément média caché le temps de lire ses
// métadonnées (durée, dimensions pour la vidéo), puis libère l'URL objet créée.
function readMediaMetadata(file, tag) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    const url = URL.createObjectURL(file);
    el.preload = 'metadata';
    el.src = url;
    el.onloadedmetadata = () => {
      const meta = { duration: el.duration };
      if (tag === 'video') {
        meta.width = el.videoWidth;
        meta.height = el.videoHeight;
      }
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t('error.mediaUnreadable')));
    };
  });
}

async function inspectImage(file) {
  const items = [];
  if (isSvgFile(file)) {
    const text = await readFileAsText(file);
    // Un SVG n'a pas forcément de dimensions en pixels (unités relatives, viewBox
    // seul...) : on affiche ce qu'on trouve dans les attributs width/height/viewBox du
    // <svg> racine, sans tenter de le rasteriser juste pour l'inspecter.
    const widthMatch = /width="([\d.]+)/.exec(text);
    const heightMatch = /height="([\d.]+)/.exec(text);
    const viewBoxMatch = /viewBox="([^"]+)"/.exec(text);
    if (widthMatch && heightMatch) items.push({ label: t('inspect.declaredDimensions'), value: `${widthMatch[1]} × ${heightMatch[1]}` });
    if (viewBoxMatch) items.push({ label: 'viewBox', value: viewBoxMatch[1] });
    items.push({ label: t('inspect.type'), value: t('inspect.typeVector') });
    return items;
  }

  const sourceBlob = isHeicFile(file) ? await heicToPngBlob(file) : file;
  const dataUrl = await readFileAsDataUrl(sourceBlob);
  const img = await loadImage(dataUrl);
  items.push({ label: t('inspect.dimensions'), value: `${img.naturalWidth} × ${img.naturalHeight} px` });
  items.push({ label: t('inspect.ratio'), value: (img.naturalWidth / img.naturalHeight).toFixed(3) });
  if (isHeicFile(file)) items.push({ label: t('inspect.note'), value: t('inspect.heicNote') });
  return items;
}

async function inspectAudio(file) {
  const meta = await readMediaMetadata(file, 'audio');
  const items = [{ label: t('inspect.duration'), value: formatDuration(meta.duration) }];
  if (Number.isFinite(meta.duration) && meta.duration > 0) {
    const kbps = Math.round((file.size * 8) / meta.duration / 1000);
    items.push({ label: t('inspect.avgBitrate'), value: `${kbps} kbps` });
  }
  return items;
}

async function inspectVideo(file) {
  const meta = await readMediaMetadata(file, 'video');
  const items = [
    { label: t('inspect.duration'), value: formatDuration(meta.duration) },
    { label: t('inspect.resolution'), value: `${meta.width} × ${meta.height} px` },
  ];
  if (Number.isFinite(meta.duration) && meta.duration > 0) {
    const kbps = Math.round((file.size * 8) / meta.duration / 1000);
    items.push({ label: t('inspect.avgBitrate'), value: `${kbps} kbps` });
  }
  return items;
}

async function inspectData(file) {
  const workbook = await fileToWorkbook(file);
  const items = [{ label: t('inspect.sheets'), value: workbook.SheetNames.join(', ') }];
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const columnCount = rows.length ? Math.max(...rows.map((r) => r.length)) : 0;
  items.push({ label: t('inspect.rows'), value: String(rows.length) });
  items.push({ label: t('inspect.columns'), value: String(columnCount) });
  if (rows.length) items.push({ label: t('inspect.headers'), value: rows[0].join(', ') });
  return items;
}

async function inspectSubtitle(file) {
  const text = await file.text();
  const ext = extensionOf(file);
  const cues = parseSubtitle(text, ext);
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
 * @param {File} file
 * @param {'image'|'data'|'audio'|'video'|'subtitle'} category
 * @returns {Promise<Array<{label: string, value: string}>>}
 */
async function inspectFile(file, category) {
  const generic = [
    { label: t('inspect.name'), value: file.name },
    { label: t('inspect.size'), value: formatBytes(file.size) },
    { label: t('inspect.lastModified'), value: formatDate(file.lastModified) },
  ];

  let specific = [];
  if (category === 'image') specific = await inspectImage(file);
  else if (category === 'audio') specific = await inspectAudio(file);
  else if (category === 'video') specific = await inspectVideo(file);
  else if (category === 'data') specific = await inspectData(file);
  else if (category === 'subtitle') specific = await inspectSubtitle(file);

  return [...generic, ...specific];
}
