/**
 * Conversion audio, 100% côté navigateur via ffmpeg.wasm (voir ffmpeg-engine.js).
 */

const AUDIO_MIME = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  wma: 'audio/x-ms-wma',
  opus: 'audio/opus',
};

/**
 * Convertit un fichier audio vers le format cible et retourne un Blob.
 * @param {File} file
 * @param {keyof AUDIO_MIME} targetFormat
 * @param {(percent: number) => void} [onProgress]
 */
async function convertAudio(file, targetFormat, onProgress) {
  const ffmpeg = await loadFFmpeg(onProgress);

  const inExt = extensionOf(file) || 'wav';
  const inName = `input.${inExt}`;
  const outName = `output.${targetFormat}`;

  await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
  await ffmpeg.exec(['-i', inName, outName]);
  const data = await ffmpeg.readFile(outName);

  await ffmpeg.deleteFile(inName);
  await ffmpeg.deleteFile(outName);

  return new Blob([data.buffer], { type: AUDIO_MIME[targetFormat] || 'application/octet-stream' });
}
