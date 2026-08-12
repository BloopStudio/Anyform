/**
 * Conversion vidéo (MP4 / WebM), 100% côté navigateur via ffmpeg.wasm.
 * Le moteur (@ffmpeg/ffmpeg + @ffmpeg/util + le core mono-thread, ~31 Mo) est vendorisé
 * dans public/vendor/ffmpeg/ — aucun appel réseau externe, aucune dépendance à un CDN.
 * Le core mono-thread ne nécessite pas les en-têtes COOP/COEP, donc ça fonctionne tel quel
 * sur GitHub Pages.
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

const VIDEO_MIME = {
  mp4: 'video/mp4',
  webm: 'video/webm',
};

/**
 * Convertit un fichier vidéo vers mp4/webm et retourne un Blob.
 * @param {File} file
 * @param {'mp4'|'webm'} targetFormat
 * @param {(percent: number) => void} [onProgress]
 */
async function convertVideo(file, targetFormat, onProgress) {
  const ffmpeg = await loadFFmpeg(onProgress);

  const inExt = extensionOf(file) || 'mp4';
  const inName = `input.${inExt}`;
  const outName = `output.${targetFormat}`;

  await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
  await ffmpeg.exec(['-i', inName, outName]);
  const data = await ffmpeg.readFile(outName);

  await ffmpeg.deleteFile(inName);
  await ffmpeg.deleteFile(outName);

  return new Blob([data.buffer], { type: VIDEO_MIME[targetFormat] || 'application/octet-stream' });
}
