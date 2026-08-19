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
