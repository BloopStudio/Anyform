#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const {
  convertImage,
  compressImage,
  compressPdf,
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
const { inspectFile } = require('../lib/inspect');
const { compareFiles } = require('../lib/compare');
const { t } = require('../lib/i18n');

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

// "info" reconnaît des formats de plus que la conversion : PDF et ZIP ne sont pas du tout
// des formats qu'Anyform convertit, mais les inspecter n'a besoin que de lire leurs
// métadonnées. Séparé de CATEGORY_EXT pour ne pas les rendre éligibles à convertOne/
// compressOne, qui n'ont rien à en faire.
const INSPECT_ONLY_EXT = { pdf: 'document', zip: 'archive' };

function detectInspectCategory(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return detectCategory(filePath) || INSPECT_ONLY_EXT[ext] || null;
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
    throw new Error(t('cli.errUnrecognizedFileType', { file: filePath }));
  }

  const sourceExt = normalizeExt(path.extname(filePath).slice(1).toLowerCase());
  if (sourceExt === normalizeExt(target)) {
    throw new Error(t('cli.errSameFormat', { target }));
  }

  const outDir = options.outDir || path.dirname(filePath);
  fs.mkdirSync(outDir, { recursive: true });
  const baseName = path.parse(filePath).name;
  const outPath = path.join(outDir, `${baseName}.${target}`);

  if (category === 'image') {
    if (!IMAGE_FORMATS.includes(target)) throw new Error(t('cli.errImageFormatUnsupported', { format: target }));
    const inputBuffer = fs.readFileSync(filePath);
    const result = await convertImage(inputBuffer, target, {
      quality: options.quality,
      density: options.density,
    });
    fs.writeFileSync(outPath, result);
  } else if (category === 'data') {
    if (!DATA_FORMATS.includes(target)) throw new Error(t('cli.errDataFormatUnsupported', { format: target }));
    const inputBuffer = fs.readFileSync(filePath);
    const result = convertData(inputBuffer, sourceExt, target);
    fs.writeFileSync(outPath, result);
  } else if (category === 'audio') {
    if (!AUDIO_FORMATS.includes(target)) throw new Error(t('cli.errAudioFormatUnsupported', { format: target }));
    await convertMedia(filePath, outPath);
  } else if (category === 'video') {
    if (!VIDEO_FORMATS.includes(target)) throw new Error(t('cli.errVideoFormatUnsupported', { format: target }));
    await convertMedia(filePath, outPath);
  } else if (category === 'subtitle') {
    if (!SUBTITLE_FORMATS.includes(target)) throw new Error(t('cli.errSubtitleFormatUnsupported', { format: target }));
    const text = fs.readFileSync(filePath, 'utf8');
    const result = convertSubtitle(text, sourceExt, target);
    fs.writeFileSync(outPath, result);
  }

  return outPath;
}

/**
 * Compresse un fichier image, audio, vidéo ou PDF en conservant son format d'origine
 * (contraire de convertOne, qui change de format). Les données et sous-titres n'ont pas de
 * notion de "réduire la taille en gardant le même format" et ne sont donc jamais acceptés
 * ici. Le PDF n'est pas dans CATEGORY_EXT (pas convertible par Anyform, voir
 * detectInspectCategory) mais est bien compressible, d'où le test séparé sur l'extension.
 */
async function compressOne(filePath, level, options) {
  const rawExt = path.extname(filePath).slice(1).toLowerCase();
  const category = rawExt === 'pdf' ? 'document' : detectCategory(filePath);
  if (category !== 'image' && category !== 'audio' && category !== 'video' && category !== 'document') {
    throw new Error(t('cli.errCompressUnsupportedType', { file: filePath }));
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

  if (category === 'document') {
    const inputBuffer = fs.readFileSync(filePath);
    const result = await compressPdf(inputBuffer, level);
    const outPath = path.join(outDir, `${baseName}-compresse.pdf`);
    fs.writeFileSync(outPath, result);
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
const COMPRESS_FORMATS = [...new Set([...COMPRESSIBLE_IMAGE_FORMATS, ...AUDIO_FORMATS, ...VIDEO_FORMATS, 'pdf'])];

const { version } = require('../package.json');

const program = new Command();

program
  .name('anyform')
  .version(version)
  .description(t('cli.description'))
  .argument('<files...>', t('cli.filesArg'))
  .option('-t, --to <format>', `${t('cli.optTo')} (${ALL_FORMATS.join(', ')})`)
  .option('-c, --compress', `${t('cli.optCompress')} (${COMPRESS_FORMATS.join(', ')})${t('cli.optCompressSuffix')}`)
  .option('-l, --level <level>', t('cli.optLevel'), 'medium')
  .option('-o, --out-dir <dir>', t('cli.optOutDir'))
  .option('-q, --quality <number>', t('cli.optQuality'), (v) => parseInt(v, 10))
  .option('-d, --density <number>', t('cli.optDensity'), (v) => parseInt(v, 10))
  .option('--lang <lang>', t('cli.optLang'))
  .action(async (files, options) => {
    if (!options.to && !options.compress) {
      console.error(t('cli.errNeedToOrCompress'));
      process.exitCode = 1;
      return;
    }
    if (options.to && options.compress) {
      console.error(t('cli.errToAndCompressExclusive'));
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

// Sous-commandes séparées plutôt que des options de la commande racine : "info" n'a pas de
// format de sortie et "diff" a besoin d'exactement deux fichiers, ce qui ne rentre pas dans
// le modèle "un ou plusieurs fichiers -> un format cible" de convertOne/compressOne.
program
  .command('info <file>')
  .description(t('cli.infoDescription'))
  .option('--json', t('cli.optJson'))
  .option('--lang <lang>', t('cli.optLang'))
  .action(async (filePath, options) => {
    const category = detectInspectCategory(filePath);
    if (!category) {
      console.error(t('cli.errUnrecognizedFileTypeInfo', { file: filePath }));
      process.exitCode = 1;
      return;
    }

    try {
      const sourceExt = normalizeExt(path.extname(filePath).slice(1).toLowerCase());
      const items = await inspectFile(filePath, category, sourceExt);

      if (options.json) {
        console.log(JSON.stringify(Object.fromEntries(items.map((i) => [i.label, i.value])), null, 2));
      } else {
        const width = Math.max(...items.map((i) => i.label.length));
        for (const item of items) console.log(`${item.label.padEnd(width)}  ${item.value}`);
      }
    } catch (err) {
      console.error(t('cli.errGeneric', { message: err.message }));
      process.exitCode = 1;
    }
  });

program
  .command('diff <fileA> <fileB>')
  .description(t('cli.diffDescription'))
  // Pas de forme courte -o : la commande racine utilise déjà -o pour --out-dir, et
  // Commander résout les options courtes au niveau du programme entier, pas par
  // sous-commande — un -o ici serait silencieusement absorbé par --out-dir.
  .option('--out <path>', t('cli.optOut'))
  .option('--lang <lang>', t('cli.optLang'))
  .action(async (pathA, pathB, options) => {
    const categoryA = detectCategory(pathA);
    const categoryB = detectCategory(pathB);

    if (!categoryA || !categoryB) {
      console.error(t('cli.errUnrecognizedTypeOneOfTwo'));
      process.exitCode = 1;
      return;
    }
    if (categoryA !== categoryB) {
      console.error(t('cli.errMustBeSameType'));
      process.exitCode = 1;
      return;
    }

    try {
      const result = await compareFiles(pathA, pathB, categoryA);
      const baseName = path.parse(pathA).name;

      if (result.type === 'image') {
        console.log(
          result.identical ? t('cli.imagesIdentical') : t('cli.percentIdentical', { percent: result.percentIdentical })
        );
        if (result.sizeMismatch) {
          console.log(t('cli.dimensionsMismatch', { a: result.dimensionsA, b: result.dimensionsB }));
        }
        const outPath = options.out || path.join(path.dirname(pathA), `${baseName}-diff.png`);
        fs.writeFileSync(outPath, result.diffBuffer);
        console.log(t('cli.diffWritten', { path: outPath }));
      } else if (result.type === 'text') {
        console.log(
          result.identical ? t('cli.filesIdentical') : t('cli.linesChanged', { added: result.added, removed: result.removed })
        );
        const diffText = result.diff
          .filter((line) => line.type !== 'equal')
          .map((line) => `${line.type === 'added' ? '+' : '-'} ${line.text}`)
          .join('\n');
        if (options.out) {
          fs.writeFileSync(options.out, diffText + '\n');
          console.log(t('cli.diffWritten', { path: options.out }));
        } else if (diffText) {
          console.log(diffText);
        }
      } else {
        console.log(result.identical ? t('cli.hashIdentical') : t('cli.filesDifferent'));
        if (result.tooLarge) {
          console.log(t('cli.tooLarge'));
        }
        console.log(t('cli.sizeHash', { label: 'A', size: result.sizeA, hash: result.hashA }));
        console.log(t('cli.sizeHash', { label: 'B', size: result.sizeB, hash: result.hashB }));
      }
    } catch (err) {
      console.error(t('cli.errGeneric', { message: err.message }));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
