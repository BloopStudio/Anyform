/**
 * Conversion vidéo, 100% côté navigateur via ffmpeg.wasm (voir ffmpeg-engine.js).
 */

const VIDEO_MIME = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  gif: 'image/gif',
  ogv: 'video/ogg',
  flv: 'video/x-flv',
};

/**
 * Convertit un fichier vidéo vers le format cible et retourne un Blob.
 * @param {File} file
 * @param {keyof VIDEO_MIME} targetFormat
 * @param {(percent: number) => void} [onProgress]
 */
async function convertVideo(file, targetFormat, onProgress) {
  const inExt = extensionOf(file) || 'mp4';
  return runFfmpeg(file, inExt, targetFormat, [], onProgress, VIDEO_MIME[targetFormat]);
}
