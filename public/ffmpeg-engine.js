/**
 * Chargement partagé du moteur ffmpeg.wasm (utilisé par audio.js et video.js).
 * Vendorisé localement dans public/vendor/ffmpeg/ — aucun appel réseau externe.
 */

let ffmpegPromise = null;

/**
 * Charge et initialise ffmpeg.wasm une seule fois par session (mise en cache dans
 * `ffmpegPromise`) : le téléchargement/l'instanciation du binaire WASM est coûteux, pas la
 * peine de le refaire à chaque conversion audio/vidéo.
 * @param {(percent: number) => void} [onProgress] rappelé pendant l'exécution ffmpeg (pas le chargement lui-même)
 * @returns {Promise<FFmpeg>} l'instance ffmpeg prête à l'emploi
 */
async function loadFFmpeg(onProgress) {
  if (ffmpegPromise) return ffmpegPromise;

  ffmpegPromise = (async () => {
    const { FFmpeg } = await import('./vendor/ffmpeg/ffmpeg/index.js');
    const { toBlobURL } = await import('./vendor/ffmpeg/util/index.js');

    const ffmpeg = new FFmpeg();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
    }

    await ffmpeg.load({
      coreURL: await toBlobURL('./vendor/ffmpeg/core/ffmpeg-core.js', 'text/javascript'),
      wasmURL: await toBlobURL('./vendor/ffmpeg/core/ffmpeg-core.wasm', 'application/wasm'),
    });

    return ffmpeg;
  })();

  return ffmpegPromise;
}

/**
 * Exécute ffmpeg.wasm sur un fichier : écrit l'entrée dans son système de fichiers virtuel,
 * lance la commande, lit la sortie puis nettoie, et retourne le résultat en Blob. Partagé par
 * les 4 fonctions convert/compress audio et vidéo (audio.js, video.js, compress.js), qui ne
 * diffèrent que par les arguments ffmpeg et le type MIME de sortie.
 * @param {File} file
 * @param {string} inExt extension du fichier d'entrée (nom du fichier virtuel ffmpeg)
 * @param {string} outExt extension du fichier de sortie
 * @param {string[]} args arguments ffmpeg entre `-i input` et le nom de sortie
 * @param {(percent: number) => void} [onProgress]
 * @param {string} [mimeType]
 * @returns {Promise<Blob>}
 */
async function runFfmpeg(file, inExt, outExt, args, onProgress, mimeType) {
  const ffmpeg = await loadFFmpeg(onProgress);

  const inName = `input.${inExt}`;
  const outName = `output.${outExt}`;

  await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
  await ffmpeg.exec(['-i', inName, ...args, outName]);
  const data = await ffmpeg.readFile(outName);

  await ffmpeg.deleteFile(inName);
  await ffmpeg.deleteFile(outName);

  return new Blob([data.buffer], { type: mimeType || 'application/octet-stream' });
}
