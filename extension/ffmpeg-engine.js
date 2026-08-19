/**
 * Chargement partagé du moteur ffmpeg.wasm (utilisé par audio.js et video.js).
 * Vendorisé localement dans vendor/ffmpeg/ — aucun appel réseau externe.
 *
 * Les fichiers sont passés directement (pas de blob: URL via toBlobURL) : les URL blob
 * comme source de script sont bloquées par la CSP par défaut des extensions (MV3), et ce
 * détour n'a de toute façon plus d'utilité maintenant que tout est vendorisé en local.
 */

// Mémorise la promesse (pas juste l'instance) pour que des appels concurrents pendant le
// chargement attendent la même initialisation en cours, au lieu de charger ffmpeg.wasm
// plusieurs fois en parallèle si l'utilisateur enchaîne deux conversions audio/vidéo vite.
let ffmpegPromise = null;

/**
 * Charge (une seule fois par session du service worker/popup) et retourne l'instance
 * partagée de ffmpeg.wasm, utilisée par audio.js et video.js pour toute conversion/
 * compression audio ou vidéo. onProgress, s'il est fourni, est branché sur l'événement
 * 'progress' de ffmpeg — seul le dernier appelant à charger ffmpeg définit ce callback,
 * ce qui est acceptable ici car une seule conversion média tourne à la fois dans l'UI.
 */
async function loadFFmpeg(onProgress) {
  if (ffmpegPromise) return ffmpegPromise;

  ffmpegPromise = (async () => {
    const { FFmpeg } = await import('./vendor/ffmpeg/ffmpeg/index.js');

    const ffmpeg = new FFmpeg();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
    }

    await ffmpeg.load({
      coreURL: chrome.runtime.getURL('vendor/ffmpeg/core/ffmpeg-core.js'),
      wasmURL: chrome.runtime.getURL('vendor/ffmpeg/core/ffmpeg-core.wasm'),
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
