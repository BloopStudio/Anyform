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
