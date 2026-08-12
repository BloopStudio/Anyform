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
