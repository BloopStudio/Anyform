/**
 * Système de traduction FR/EN. Volontairement simple (pas de librairie) : un dictionnaire
 * plat par clé, une fonction t() pour le JS, des attributs data-i18n-* pour le HTML
 * statique. La langue est détectée depuis le navigateur au premier chargement, puis
 * mémorisée dans localStorage dès que l'utilisateur la change explicitement.
 */

const STRINGS = {
  'header.subtitleExt': {
    fr: "100% local, rien n'est envoyé sur internet",
    en: "100% local, nothing is sent over the internet",
  },
  'mode.convert': { fr: 'Convertisseur', en: 'Converter' },
  'mode.compress': { fr: 'Compresseur', en: 'Compressor' },
  'mode.inspect': { fr: 'Inspecteur', en: 'Inspector' },
  'mode.compare': { fr: 'Comparateur', en: 'Comparator' },
  'mode.convert.btn': { fr: 'Convertir', en: 'Convert' },
  'mode.compress.btn': { fr: 'Compresser', en: 'Compress' },
  'mode.inspect.btn': { fr: 'Inspecter', en: 'Inspect' },
  'mode.compare.btn': { fr: 'Comparer', en: 'Compare' },
  'category.label': { fr: 'Type de fichier', en: 'File type' },
  'category.image': { fr: 'Image', en: 'Image' },
  'category.data': { fr: 'Données', en: 'Data' },
  'category.audio': { fr: 'Audio', en: 'Audio' },
  'category.video': { fr: 'Vidéo', en: 'Video' },
  'category.subtitle': { fr: 'Sous-titres', en: 'Subtitles' },
  'field.sourceFormat': { fr: "Format d'entrée", en: 'Input format' },
  'field.outputFormat': { fr: 'Format de sortie', en: 'Output format' },
  'field.compressionLevel': { fr: 'Niveau de compression', en: 'Compression level' },
  'compression.light': { fr: 'Léger — qualité quasi identique', en: 'Light — near-identical quality' },
  'compression.medium': { fr: 'Moyen — bon compromis', en: 'Medium — good balance' },
  'compression.strong': { fr: 'Fort — fichier le plus léger', en: 'Strong — smallest file' },
  'format.svgVector': { fr: 'SVG (vectorisation)', en: 'SVG (vectorization)' },
  'format.gifAnimated': { fr: 'GIF (animé)', en: 'GIF (animated)' },
  'dropzone.single': { fr: 'Glisse un fichier ici ou clique pour en choisir un', en: 'Drag a file here, or click to choose one' },
  'dropzone.single.aria': { fr: 'Choisir un fichier à convertir', en: 'Choose a file to convert' },
  'dropzone.fileA': { fr: 'Fichier A', en: 'File A' },
  'dropzone.fileB': { fr: 'Fichier B', en: 'File B' },
  'dropzone.fileA.aria': { fr: 'Choisir le premier fichier', en: 'Choose the first file' },
  'dropzone.fileB.aria': { fr: 'Choisir le second fichier', en: 'Choose the second file' },
  'preview.original': { fr: 'Original', en: 'Original' },
  'preview.result': { fr: 'Résultat', en: 'Result' },
  'preview.before.alt': { fr: 'Aperçu du fichier original', en: 'Preview of the original file' },
  'preview.after.alt': { fr: 'Aperçu du fichier converti', en: 'Preview of the converted file' },
  'btn.download': { fr: 'Télécharger', en: 'Download' },
  'btn.newFile': { fr: 'Nouveau fichier', en: 'New file' },
  'btn.clear': { fr: 'Vider', en: 'Clear' },
  'btn.downloadDiff': { fr: 'Télécharger la diff', en: 'Download the diff' },
  'history.label': { fr: 'Historique récent', en: 'Recent history' },
  'footer.by': { fr: 'par BloopStudio', en: 'by BloopStudio' },

  'status.converting': { fr: 'Conversion en cours…', en: 'Converting…' },
  'status.compressing': { fr: 'Compression en cours…', en: 'Compressing…' },
  'status.analyzing': { fr: 'Analyse en cours…', en: 'Analyzing…' },
  'status.comparing': { fr: 'Comparaison en cours…', en: 'Comparing…' },
  'status.loadingAudioEngine': {
    fr: 'Chargement du moteur audio (une seule fois par session)…',
    en: 'Loading audio engine (once per session)…',
  },
  'status.loadingVideoEngine': {
    fr: 'Chargement du moteur vidéo (une seule fois par session)…',
    en: 'Loading video engine (once per session)…',
  },

  'error.categoryNotSupportedCompress': { fr: 'Type de fichier non supporté par le compresseur.', en: 'File type not supported by the compressor.' },
  'error.categoryNotSupported': { fr: 'Type de fichier non supporté.', en: 'File type not supported.' },
  'error.compareDifferentTypes': {
    fr: 'Les deux fichiers doivent être du même type reconnu par Anyform pour être comparés.',
    en: 'Both files must be the same Anyform-recognized type to be compared.',
  },
  'error.compareUnrecognizedType': { fr: 'Un des deux fichiers a un format non reconnu par Anyform.', en: 'One of the two files has a format Anyform doesn\'t recognize.' },
  'error.unrecognizedFormat': { fr: 'Format .{{ext}} non reconnu par Anyform.', en: 'Format .{{ext}} not recognized by Anyform.' },
  'error.wrongInputFormat': {
    fr: "Ce fichier est un .{{ext}}, mais le format d'entrée sélectionné est .{{expected}}. Choisis le bon format d'entrée ou dépose un fichier .{{expected}}.",
    en: 'This file is a .{{ext}}, but the selected input format is .{{expected}}. Pick the right input format or drop a .{{expected}} file.',
  },
  'error.formatNotSupportedCompress': {
    fr: 'Format .{{ext}} non pris en charge par le compresseur. Formats acceptés : {{allowed}}.',
    en: 'Format .{{ext}} is not supported by the compressor. Accepted formats: {{allowed}}.',
  },
  'error.inspectFailed': { fr: "Échec de l'inspection.", en: 'Inspection failed.' },
  'error.compareFailed': { fr: 'Échec de la comparaison.', en: 'Comparison failed.' },
  'error.compressFailed': { fr: 'Échec de la compression.', en: 'Compression failed.' },
  'error.convertFailed': { fr: 'Échec de la conversion.', en: 'Conversion failed.' },

  'result.sizeChange': { fr: '{{before}} → {{after}} (-{{percent}}%)', en: '{{before}} → {{after}} (-{{percent}}%)' },
  'result.alreadyOptimized': { fr: '{{before}} → {{after}} (déjà optimisé, pas de gain)', en: '{{before}} → {{after}} (already optimized, no gain)' },

  'compare.imagesIdentical': { fr: 'Images identiques.', en: 'Identical images.' },
  'compare.percentIdentical': { fr: '{{percent}}% des pixels identiques (zone commune).', en: '{{percent}}% of pixels identical (shared area).' },
  'compare.dimensionsMismatch': {
    fr: 'Dimensions différentes : A = {{a}}, B = {{b}} — comparaison faite sur leur zone commune.',
    en: 'Different dimensions: A = {{a}}, B = {{b}} — compared on their shared area.',
  },
  'compare.diffImageAlt': { fr: 'Différences en rouge sur fond gris', en: 'Differences in red on gray background' },
  'compare.filesIdentical': { fr: 'Fichiers identiques.', en: 'Identical files.' },
  'compare.linesChanged': { fr: '{{added}} ligne(s) ajoutée(s), {{removed}} ligne(s) supprimée(s).', en: '{{added}} line(s) added, {{removed}} line(s) removed.' },
  'compare.hashIdentical': { fr: 'Fichiers identiques (même empreinte).', en: 'Identical files (same fingerprint).' },
  'compare.filesDifferent': { fr: 'Fichiers différents.', en: 'Different files.' },
  'compare.tooLarge': {
    fr: 'Fichier trop volumineux pour une diff ligne à ligne détaillée — comparaison par empreinte seulement.',
    en: 'File too large for a detailed line-by-line diff — fingerprint comparison only.',
  },
  'compare.sizeHash': { fr: '{{label}} : {{size}} — SHA-256 {{hash}}…', en: '{{label}}: {{size}} — SHA-256 {{hash}}…' },

  'inspect.name': { fr: 'Nom', en: 'Name' },
  'inspect.size': { fr: 'Taille', en: 'Size' },
  'inspect.lastModified': { fr: 'Dernière modification', en: 'Last modified' },
  'inspect.declaredDimensions': { fr: 'Dimensions déclarées', en: 'Declared dimensions' },
  'inspect.type': { fr: 'Type', en: 'Type' },
  'inspect.typeVector': { fr: 'SVG (vectoriel)', en: 'SVG (vector)' },
  'inspect.dimensions': { fr: 'Dimensions', en: 'Dimensions' },
  'inspect.ratio': { fr: 'Ratio', en: 'Ratio' },
  'inspect.note': { fr: 'Note', en: 'Note' },
  'inspect.heicNote': { fr: 'HEIC décodé pour lecture des dimensions (via heic2any)', en: 'HEIC decoded to read dimensions (via heic2any)' },
  'inspect.duration': { fr: 'Durée', en: 'Duration' },
  'inspect.durationUnknown': { fr: 'inconnue', en: 'unknown' },
  'inspect.avgBitrate': { fr: 'Débit moyen (estimé)', en: 'Average bitrate (estimated)' },
  'inspect.resolution': { fr: 'Résolution', en: 'Resolution' },
  'inspect.sheets': { fr: 'Feuilles', en: 'Sheets' },
  'inspect.rows': { fr: 'Lignes (feuille 1, en-tête incluse)', en: 'Rows (sheet 1, header included)' },
  'inspect.columns': { fr: 'Colonnes (feuille 1)', en: 'Columns (sheet 1)' },
  'inspect.headers': { fr: 'En-têtes', en: 'Headers' },
  'inspect.subtitleCount': { fr: 'Nombre de sous-titres', en: 'Number of subtitles' },
  'inspect.firstTimecode': { fr: 'Premier timecode', en: 'First timecode' },
  'inspect.lastTimecode': { fr: 'Dernier timecode', en: 'Last timecode' },
  'inspect.coveredRange': { fr: 'Plage couverte', en: 'Covered range' },
  'inspect.overlappingCues': { fr: 'Sous-titres qui se chevauchent', en: 'Overlapping subtitles' },
  'inspect.tooFastCues': { fr: 'Sous-titres trop rapides à lire (>250 mots/min)', en: 'Subtitles too fast to read (>250 wpm)' },
  'inspect.hasAlpha': { fr: 'Transparence', en: 'Transparency' },
  'inspect.yes': { fr: 'Oui', en: 'Yes' },
  'inspect.no': { fr: 'Non', en: 'No' },
  'inspect.bitDepth': { fr: 'Profondeur de bits', en: 'Bit depth' },
  'inspect.tiffPages': { fr: 'Pages', en: 'Pages' },
  'inspect.icoCount': { fr: "Nombre d'images incluses", en: 'Number of included images' },
  'inspect.icoSizes': { fr: 'Tailles incluses', en: 'Included sizes' },
  'inspect.channels': { fr: 'Canaux', en: 'Channels' },
  'inspect.mono': { fr: 'Mono', en: 'Mono' },
  'inspect.stereo': { fr: 'Stéréo', en: 'Stereo' },
  'inspect.channelsN': { fr: '{{n}} canaux', en: '{{n}} channels' },
  'inspect.sampleRate': { fr: "Fréquence d'échantillonnage", en: 'Sample rate' },
  'inspect.aspectRatio': { fr: "Format d'image", en: 'Aspect ratio' },
  'inspect.columnTypes': { fr: 'Type dominant par colonne', en: 'Dominant type per column' },
  'inspect.type.number': { fr: 'Nombre', en: 'Number' },
  'inspect.type.date': { fr: 'Date', en: 'Date' },
  'inspect.type.text': { fr: 'Texte', en: 'Text' },

  'error.mediaUnreadable': {
    fr: 'Impossible de lire ce fichier (corrompu ou format non supporté par le navigateur).',
    en: 'Unable to read this file (corrupted or format not supported by the browser).',
  },
  'error.imageLoad': { fr: "Impossible de charger l'image (fichier corrompu ou non supporté).", en: 'Unable to load the image (corrupted or unsupported file).' },
  'error.pngEncode': { fr: "Échec de l'encodage PNG intermédiaire.", en: 'Intermediate PNG encoding failed.' },
  'error.formatExportUnsupported': { fr: "Le navigateur ne supporte pas l'export en {{format}}.", en: 'Your browser does not support exporting to {{format}}.' },
  'error.formatExportUnsupportedBrowser': { fr: "Ton navigateur ne supporte pas l'export en {{format}}.", en: 'Your browser does not support exporting to {{format}}.' },
  'error.diffGeneration': { fr: 'Échec de la génération de la diff.', en: 'Failed to generate the diff.' },
  'error.compressUnsupportedFormat': { fr: 'Format non compressible : .{{ext}}. Formats supportés : PNG, JPG, WebP, HEIC.', en: 'Format not compressible: .{{ext}}. Supported formats: PNG, JPG, WebP, HEIC.' },
  'error.compressFailedGeneric': { fr: 'Échec de la compression.', en: 'Compression failed.' },
  'error.compressUnsupportedBrowser': { fr: 'Ton navigateur ne supporte pas la compression de ce format.', en: 'Your browser does not support compressing this format.' },
  'error.compressUnsupportedVideo': { fr: 'Format vidéo non compressible : .{{ext}}.', en: 'Video format not compressible: .{{ext}}.' },
  'error.compressUnsupportedAudio': { fr: 'Format audio non compressible : .{{ext}}.', en: 'Audio format not compressible: .{{ext}}.' },
  'error.dataFormatUnsupported': { fr: 'Format de données non supporté: {{format}}', en: 'Data format not supported: {{format}}' },
  'error.subtitleFormatUnsupported': { fr: 'Format de sous-titres non supporté : {{format}}', en: 'Subtitle format not supported: {{format}}' },
  'error.subtitleUnrecognized': {
    fr: 'Aucun sous-titre reconnu dans ce fichier — vérifie que le format est valide.',
    en: 'No subtitle recognized in this file — check that the format is valid.',
  },
};

const LANG_STORAGE_KEY = 'anyform-lang';

function detectLanguage() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') return stored;
  const browserLangs = navigator.languages || [navigator.language || 'fr'];
  return browserLangs.some((l) => l.toLowerCase().startsWith('en')) ? 'en' : 'fr';
}

let currentLang = detectLanguage();

function getLanguage() {
  return currentLang;
}

function setLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'fr';
  localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  document.documentElement.lang = currentLang;
  applyStaticTranslations();
  document.dispatchEvent(new CustomEvent('anyform:langchange'));
}

// {{var}} dans une chaîne du dictionnaire est remplacé par vars[var] si fourni.
function t(key, vars) {
  const entry = STRINGS[key];
  if (!entry) return key;
  let text = entry[currentLang] || entry.fr;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{{${k}}}`, v);
    }
  }
  return text;
}

// Applique les traductions aux éléments statiques du HTML, repérés par des attributs
// data-i18n (textContent), data-i18n-placeholder, data-i18n-aria-label ou data-i18n-alt.
function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    el.alt = t(el.dataset.i18nAlt);
  });
}

document.documentElement.lang = currentLang;
document.addEventListener('DOMContentLoaded', applyStaticTranslations);
