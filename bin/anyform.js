#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const { convertImage, SUPPORTED_OUTPUT_FORMATS: IMAGE_FORMATS } = require('../lib/convert');
const { convertData, SUPPORTED_DATA_FORMATS: DATA_FORMATS } = require('../lib/data');
const {
  convertMedia,
  SUPPORTED_AUDIO_FORMATS: AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS: VIDEO_FORMATS,
} = require('../lib/media');

const CATEGORY_EXT = {
  image: ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'avif', 'ico'],
  data: ['csv', 'json', 'xlsx', 'xls'],
  audio: ['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'],
  video: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'ogv'],
};

function detectCategory(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  for (const [category, exts] of Object.entries(CATEGORY_EXT)) {
    if (exts.includes(ext)) return category;
  }
  return null;
}

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
  }

  return outPath;
}

const ALL_FORMATS = [...new Set([...IMAGE_FORMATS, ...DATA_FORMATS, ...AUDIO_FORMATS, ...VIDEO_FORMATS])];

const program = new Command();

program
  .name('anyform')
  .description(
    'Convertit des fichiers image, données, audio ou vidéo vers un autre format ' +
      '(détection automatique du type selon l\'extension).'
  )
  .argument('<files...>', 'fichier(s) à convertir')
  .requiredOption('-t, --to <format>', `format de sortie (${ALL_FORMATS.join(', ')})`)
  .option('-o, --out-dir <dir>', 'dossier de sortie (par défaut : même dossier que le fichier source)')
  .option('-q, --quality <number>', 'qualité de compression pour jpg/webp/avif (1-100)', (v) => parseInt(v, 10))
  .option('-d, --density <number>', 'densité (DPI) utilisée pour rasteriser un SVG', (v) => parseInt(v, 10))
  .action(async (files, options) => {
    let hadError = false;
    const target = options.to.toLowerCase().replace(/^\./, '');

    for (const filePath of files) {
      try {
        const outPath = await convertOne(filePath, target, options);
        console.log(`✔ ${filePath} → ${outPath}`);
      } catch (err) {
        hadError = true;
        console.error(`✘ ${filePath}: ${err.message}`);
      }
    }

    if (hadError) process.exitCode = 1;
  });

program.parseAsync(process.argv);
