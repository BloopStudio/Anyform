#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const {
  convertImage,
  compressImage,
  SUPPORTED_OUTPUT_FORMATS: IMAGE_FORMATS,
  COMPRESSIBLE_IMAGE_FORMATS,
} = require('../lib/convert');
const { convertData, SUPPORTED_DATA_FORMATS: DATA_FORMATS } = require('../lib/data');
const {
  convertMedia,
  compressVideo,
  compressAudio,
  SUPPORTED_AUDIO_FORMATS: AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS: VIDEO_FORMATS,
} = require('../lib/media');
const { convertSubtitle, SUBTITLE_FORMATS } = require('../lib/subtitles');

const CATEGORY_EXT = {
  image: ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'avif', 'ico', 'heic', 'heif'],
  data: ['csv', 'json', 'xlsx', 'xls'],
  audio: ['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'],
  video: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'ogv'],
  subtitle: ['srt', 'vtt', 'ass', 'ssa'],
};

// Détecte la catégorie (image/données/audio/vidéo/sous-titres) à partir de l'extension du
// fichier — aucune lecture du contenu, purement basé sur le nom (comme sur le web/desktop/
// extension, pour un comportement cohérent partout).
function detectCategory(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  for (const [category, exts] of Object.entries(CATEGORY_EXT)) {
    if (exts.includes(ext)) return category;
  }
  return null;
}

// "jpeg" et "jpg" sont le même format sous deux extensions différentes ; on les traite
// comme identiques partout où on compare des extensions (sinon .jpeg -> jpg serait refusé
// comme "conversion vers un format identique" par erreur, et inversement accepté à tort).
function normalizeExt(ext) {
  return ext === 'jpeg' ? 'jpg' : ext;
}

async function convertOne(filePath, target, options) {
  const category = detectCategory(filePath);
  if (!category) {
    throw new Error(`Type de fichier non reconnu : ${filePath}`);
  }

  const sourceExt = normalizeExt(path.extname(filePath).slice(1).toLowerCase());
  if (sourceExt === normalizeExt(target)) {
    throw new Error(`Le format de sortie (${target}) est identique au format d'entrée.`);
  }

  const outDir = options.outDir || path.dirname(filePath);
  fs.mkdirSync(outDir, { recursive: true });
  const baseName = path.parse(filePath).name;
  const outPath = path.join(outDir, `${baseName}.${target}`);

  if (category === 'image') {
    if (!IMAGE_FORMATS.includes(target)) throw new Error(`Format image non supporté: ${target}`);
    const inputBuffer = fs.readFileSync(filePath);
    const result = await convertImage(inputBuffer, target, {
      quality: options.quality,
      density: options.density,
    });
    fs.writeFileSync(outPath, result);
  } else if (category === 'data') {
    if (!DATA_FORMATS.includes(target)) throw new Error(`Format de données non supporté: ${target}`);
    const inputBuffer = fs.readFileSync(filePath);
    const result = convertData(inputBuffer, sourceExt, target);
    fs.writeFileSync(outPath, result);
  } else if (category === 'audio') {
    if (!AUDIO_FORMATS.includes(target)) throw new Error(`Format audio non supporté: ${target}`);
    await convertMedia(filePath, outPath);
  } else if (category === 'video') {
    if (!VIDEO_FORMATS.includes(target)) throw new Error(`Format vidéo non supporté: ${target}`);
    await convertMedia(filePath, outPath);
  } else if (category === 'subtitle') {
    if (!SUBTITLE_FORMATS.includes(target)) throw new Error(`Format de sous-titres non supporté: ${target}`);
    const text = fs.readFileSync(filePath, 'utf8');
    const result = convertSubtitle(text, sourceExt, target);
    fs.writeFileSync(outPath, result);
  }

  return outPath;
}

/**
 * Compresse un fichier image, audio ou vidéo en conservant son format d'origine (contraire
 * de convertOne, qui change de format). Les données et sous-titres n'ont pas de notion de
 * "réduire la taille en gardant le même format" et ne sont donc jamais acceptés ici.
 */
async function compressOne(filePath, level, options) {
  const category = detectCategory(filePath);
  if (category !== 'image' && category !== 'audio' && category !== 'video') {
    throw new Error(`Compression non supportée pour ce type de fichier : ${filePath}`);
  }

  const outDir = options.outDir || path.dirname(filePath);
  fs.mkdirSync(outDir, { recursive: true });
  const baseName = path.parse(filePath).name;

  if (category === 'image') {
    const sourceExt = normalizeExt(path.extname(filePath).slice(1).toLowerCase());
    const inputBuffer = fs.readFileSync(filePath);
    const result = await compressImage(inputBuffer, sourceExt, level);
    // result.ext peut différer de sourceExt : le HEIC/HEIF est décodé puis compressé en
    // PNG (sharp ne sait pas ré-encoder du HEIC), donc le fichier de sortie porte .png.
    const outPath = path.join(outDir, `${baseName}-compresse.${result.ext}`);
    fs.writeFileSync(outPath, result.buffer);
    return outPath;
  }

  // Audio et vidéo : contrairement à l'image, le format de sortie est toujours identique
  // à l'entrée (compressAudio/compressVideo réencodent avec le même codec/conteneur).
  const ext = normalizeExt(path.extname(filePath).slice(1).toLowerCase());
  const outPath = path.join(outDir, `${baseName}-compresse.${ext}`);
  if (category === 'audio') {
    await compressAudio(filePath, outPath, ext, level);
  } else {
    await compressVideo(filePath, outPath, ext, level);
  }
  return outPath;
}

const ALL_FORMATS = [
  ...new Set([...IMAGE_FORMATS, ...DATA_FORMATS, ...AUDIO_FORMATS, ...VIDEO_FORMATS, ...SUBTITLE_FORMATS]),
];
const COMPRESS_FORMATS = [...new Set([...COMPRESSIBLE_IMAGE_FORMATS, ...AUDIO_FORMATS, ...VIDEO_FORMATS])];

const { version } = require('../package.json');

const program = new Command();

program
  .name('anyform')
  .version(version)
  .description(
    'Convertit des fichiers image, données, audio ou vidéo vers un autre format ' +
      '(détection automatique du type selon l\'extension).'
  )
  .argument('<files...>', 'fichier(s) à convertir')
  .option('-t, --to <format>', `format de sortie (${ALL_FORMATS.join(', ')})`)
  .option('-c, --compress', `compresser le(s) fichier(s) sans changer de format (${COMPRESS_FORMATS.join(', ')}), au lieu de convertir avec -t`)
  .option('-l, --level <level>', 'niveau de compression : light, medium, strong', 'medium')
  .option('-o, --out-dir <dir>', 'dossier de sortie (par défaut : même dossier que le fichier source)')
  .option('-q, --quality <number>', 'qualité de compression pour jpg/webp/avif (1-100)', (v) => parseInt(v, 10))
  .option('-d, --density <number>', 'densité (DPI) utilisée pour rasteriser un SVG', (v) => parseInt(v, 10))
  .action(async (files, options) => {
    if (!options.to && !options.compress) {
      console.error('Erreur : précisez soit -t/--to <format> (conversion), soit -c/--compress (compression).');
      process.exitCode = 1;
      return;
    }
    if (options.to && options.compress) {
      console.error('Erreur : -t/--to et -c/--compress sont incompatibles, choisissez l\'un ou l\'autre.');
      process.exitCode = 1;
      return;
    }

    let hadError = false;
    const target = options.to ? options.to.toLowerCase().replace(/^\./, '') : null;

    for (const filePath of files) {
      try {
        const outPath = options.compress
          ? await compressOne(filePath, options.level, options)
          : await convertOne(filePath, target, options);
        console.log(`✔ ${filePath} → ${outPath}`);
      } catch (err) {
        hadError = true;
        console.error(`✘ ${filePath}: ${err.message}`);
      }
    }

    if (hadError) process.exitCode = 1;
  });

program.parseAsync(process.argv);
