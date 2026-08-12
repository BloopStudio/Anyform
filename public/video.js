/**
 * Conversion vidéo (MP4 / WebM), 100% côté navigateur via ffmpeg.wasm.
 * Le moteur ffmpeg.wasm (~30 Mo) est chargé à la demande depuis un CDN (import ESM
 * dynamique), uniquement quand l'utilisateur convertit un fichier vidéo — pas de
 * vendoring dans le dépôt. Le core mono-thread ne nécessite pas les en-têtes
 * COOP/COEP, donc ça fonctionne tel quel sur GitHub Pages.
 */

const FFMPEG_VERSION = '0.12.15';
const FFMPEG_UTIL_VERSION = '0.12.2';
const FFMPEG_CORE_VERSION = '0.12.10';
const FFMPEG_CDN_BASE = 'https://unpkg.com';

let ffmpegPromise = null;

async function loadFFmpeg(onProgress) {
  if (ffmpegPromise) return ffmpegPromise;

  ffmpegPromise = (async () => {
    const { FFmpeg } = await import(
      /* webpackIgnore: true */ `${FFMPEG_CDN_BASE}/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/index.js`
    );
    const { toBlobURL } = await import(
      /* webpackIgnore: true */ `${FFMPEG_CDN_BASE}/@ffmpeg/util@${FFMPEG_UTIL_VERSION}/dist/esm/index.js`
    );

    const coreBase = `${FFMPEG_CDN_BASE}/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;
    const ffmpeg = new FFmpeg();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
    }

    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
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
