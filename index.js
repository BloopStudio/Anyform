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

// Images (lib/convert.js) : conversion/compression sharp + imagetracerjs (raster → SVG),
// décodage HEIC/HEIF et compression PDF (recompression des JPEG intégrés). Renommage de
// SUPPORTED_OUTPUT_FORMATS en SUPPORTED_IMAGE_FORMATS pour éviter toute collision avec les
// constantes de formats des autres domaines (données, audio, vidéo, sous-titres) importées
// plus bas.
const {
  convertImage,
  compressImage,
  compressPdf,
  traceToSvg,
  normalizeFormat,
  isSvgBuffer,
  isHeicBuffer,
  decodeHeic,
  COMPRESSIBLE_IMAGE_FORMATS,
  RASTER_FORMATS,
  SUPPORTED_OUTPUT_FORMATS: SUPPORTED_IMAGE_FORMATS,
} = require('./lib/convert');

// Données (lib/data.js) : conversion CSV/JSON/XLSX via SheetJS. bufferToWorkbook est exposée
// séparément de convertData pour l'appelant qui veut manipuler le classeur SheetJS lui-même
// (plusieurs feuilles, styles, etc.) plutôt que se limiter à une conversion directe.
const { convertData, bufferToWorkbook, SUPPORTED_DATA_FORMATS } = require('./lib/data');

// Audio/vidéo (lib/media.js) : passe par le binaire ffmpeg statique de ffmpeg-static. convertMedia
// change de format, compressVideo/compressAudio réduisent la taille au même format.
const {
  convertMedia,
  compressVideo,
  compressAudio,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
} = require('./lib/media');

// Sous-titres (lib/subtitles.js) : texte pur, aucune dépendance externe. convertSubtitle
// enchaîne parseSubtitle (texte → structure interne) puis le sérialiseur du format cible ;
// parseSubtitle est exposée à part pour l'appelant qui veut juste lire la structure.
const { convertSubtitle, parseSubtitle, SUBTITLE_FORMATS } = require('./lib/subtitles');

// Inspection (lib/inspect.js) et comparaison (lib/compare.js) : lecture seule, aucun fichier
// n'est modifié ni recréé.
const { inspectFile } = require('./lib/inspect');
const { compareFiles } = require('./lib/compare');

// i18n (lib/i18n.js) : traduction FR/EN des messages, partagée par tous les modules ci-dessus
// pour la construction de leurs messages d'erreur.
const { t, getLanguage } = require('./lib/i18n');

module.exports = {
  // Images — Buffer en entrée, Buffer en sortie. Formats : SVG, PNG, JPG, WebP, GIF, BMP,
  // TIFF, AVIF, ICO, HEIC/HEIF en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG en sortie.
  convertImage,
  compressImage,
  compressPdf,
  traceToSvg,
  normalizeFormat,
  isSvgBuffer,
  isHeicBuffer,
  decodeHeic,
  COMPRESSIBLE_IMAGE_FORMATS,
  RASTER_FORMATS,
  SUPPORTED_IMAGE_FORMATS,

  // Données — Buffer en entrée, Buffer en sortie. CSV ⇄ JSON ⇄ XLSX (SheetJS).
  // bufferToWorkbook s'arrête à l'étape intermédiaire (buffer → classeur SheetJS) pour
  // l'appelant qui veut inspecter/modifier le classeur avant de le sérialiser lui-même.
  convertData,
  bufferToWorkbook,
  SUPPORTED_DATA_FORMATS,

  // Audio/vidéo — chemins de fichiers (ffmpeg lit/écrit sur disque, pas de Buffer en
  // entrée/sortie possible ici). convertMedia change de format ; compressVideo/compressAudio
  // réduisent la taille en conservant le format d'origine.
  convertMedia,
  compressVideo,
  compressAudio,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS,

  // Sous-titres — texte en entrée, texte en sortie, aucune dépendance. SRT ⇄ VTT ⇄ ASS.
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
