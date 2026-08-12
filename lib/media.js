const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const SUPPORTED_AUDIO_FORMATS = ['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a'];
const SUPPORTED_VIDEO_FORMATS = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

/**
 * Convertit un fichier audio ou vidéo via le binaire ffmpeg statique (ffmpeg-static).
 * @param {string} inputPath
 * @param {string} outputPath
 */
function convertMedia(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ['-y', '-i', inputPath, outputPath]);

    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg a échoué (code ${code}):\n${stderr.split('\n').slice(-15).join('\n')}`));
    });
  });
}

module.exports = { convertMedia, SUPPORTED_AUDIO_FORMATS, SUPPORTED_VIDEO_FORMATS };
