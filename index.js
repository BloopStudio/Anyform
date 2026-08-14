/**
 * Anyform — conversion de fichiers (images, données, audio, vidéo, sous-titres), 100%
 * locale. Point d'entrée de la bibliothèque : ré-exporte les fonctions de lib/, telles
 * quelles (même code que le CLI `anyform`, moins Commander).
 *
 * Les fonctions image/données travaillent sur des Buffer et retournent un Buffer/objet en
 * mémoire. Les fonctions audio/vidéo (ffmpeg) et sous-titres/inspection/comparaison
 * travaillent sur des chemins de fichiers sur disque — ffmpeg n'accepte pas de flux en
 * entrée sans nommer un fichier réel, donc ce n'est pas un choix arbitraire.
 */

const {
  convertImage,
  compressImage,
  traceToSvg,
  normalizeFormat,
  isSvgBuffer,
  isHeicBuffer,
  decodeHeic,
  COMPRESSIBLE_IMAGE_FORMATS,
  RASTER_FORMATS,
  SUPPORTED_OUTPUT_FORMATS: SUPPORTED_IMAGE_FORMATS,
} = require('./lib/convert');

const { convertData, bufferToWorkbook, SUPPORTED_DATA_FORMATS } = require('./lib/data');

const {
  convertMedia,
  compressVideo,
  compressAudio,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
} = require('./lib/media');

const { convertSubtitle, parseSubtitle, SUBTITLE_FORMATS } = require('./lib/subtitles');
const { inspectFile } = require('./lib/inspect');
const { compareFiles } = require('./lib/compare');
const { t, getLanguage } = require('./lib/i18n');

module.exports = {
  // Images — Buffer en entrée, Buffer en sortie. Formats : SVG, PNG, JPG, WebP, GIF, BMP,
  // TIFF, AVIF, ICO, HEIC/HEIF en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG en sortie.
  convertImage,
  compressImage,
  traceToSvg,
  normalizeFormat,
  isSvgBuffer,
  isHeicBuffer,
  decodeHeic,
  COMPRESSIBLE_IMAGE_FORMATS,
  RASTER_FORMATS,
  SUPPORTED_IMAGE_FORMATS,

  // Données — Buffer en entrée, Buffer en sortie. CSV ⇄ JSON ⇄ XLSX.
  convertData,
  bufferToWorkbook,
  SUPPORTED_DATA_FORMATS,

  // Audio/vidéo — chemins de fichiers (ffmpeg lit/écrit sur disque, pas de Buffer en
  // entrée/sortie possible ici).
  convertMedia,
  compressVideo,
  compressAudio,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS,

  // Sous-titres — texte en entrée, texte en sortie. SRT ⇄ VTT ⇄ ASS.
  convertSubtitle,
  parseSubtitle,
  SUBTITLE_FORMATS,

  // Inspection et comparaison — chemins de fichiers, aucune modification du fichier source.
  inspectFile,
  compareFiles,

  // Traduction FR/EN des messages (utilisée en interne par les fonctions ci-dessus pour
  // leurs erreurs) — exposée au cas où l'appelant veut afficher ses propres messages dans
  // la même langue. Détection identique au CLI : $LC_ALL/$LANG/$LANGUAGE, repli sur le
  // français. Pas de --lang ici (pas de ligne de commande) ; forcer la langue se fait via
  // la variable d'environnement avant d'importer le module.
  t,
  getLanguage,
};
