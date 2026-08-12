#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const { convertImage, SUPPORTED_OUTPUT_FORMATS } = require('../lib/convert');

const program = new Command();

program
  .name('converter')
  .description("Convertit des fichiers image d'un format vers un autre (SVG, PNG, JPG, WebP, TIFF, GIF, AVIF).")
  .argument('<files...>', 'fichier(s) à convertir')
  .requiredOption('-t, --to <format>', `format de sortie (${SUPPORTED_OUTPUT_FORMATS.join(', ')})`)
  .option('-o, --out-dir <dir>', 'dossier de sortie (par défaut : même dossier que le fichier source)')
  .option('-q, --quality <number>', "qualité de compression pour jpg/webp/avif (1-100)", (v) => parseInt(v, 10))
  .option('-d, --density <number>', 'densité (DPI) utilisée pour rasteriser un SVG', (v) => parseInt(v, 10))
  .action(async (files, options) => {
    let hadError = false;

    for (const filePath of files) {
      try {
        const inputBuffer = fs.readFileSync(filePath);
        const result = await convertImage(inputBuffer, options.to, {
          quality: options.quality,
          density: options.density,
        });

        const outDir = options.outDir || path.dirname(filePath);
        fs.mkdirSync(outDir, { recursive: true });

        const baseName = path.parse(filePath).name;
        const target = options.to.toLowerCase().replace(/^\./, '');
        const outPath = path.join(outDir, `${baseName}.${target}`);

        fs.writeFileSync(outPath, result);
        console.log(`✔ ${filePath} → ${outPath}`);
      } catch (err) {
        hadError = true;
        console.error(`✘ ${filePath}: ${err.message}`);
      }
    }

    if (hadError) process.exitCode = 1;
  });

program.parseAsync(process.argv);
