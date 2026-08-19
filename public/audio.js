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
  const inExt = extensionOf(file) || 'wav';
  return runFfmpeg(file, inExt, targetFormat, [], onProgress, AUDIO_MIME[targetFormat]);
}
