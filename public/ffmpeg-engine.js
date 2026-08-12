/**
 * Chargement partagé du moteur ffmpeg.wasm (utilisé par audio.js et video.js).
 * Vendorisé localement dans public/vendor/ffmpeg/ — aucun appel réseau externe.
 */

let ffmpegPromise = null;

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
