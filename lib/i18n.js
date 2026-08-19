/**
 * Traduction FR/EN pour les messages du CLI. Contrairement au web/desktop/extension (qui
 * ont un sélecteur en direct dans l'interface), le CLI est un process qui se termine après
 * chaque appel : pas besoin de mémoriser un choix, juste de détecter la langue une fois au
 * démarrage — via --lang, sinon $LANG/$LC_ALL/$LANGUAGE, sinon français par défaut.
 */

const STRINGS = {
  'cli.description': {
    fr: "Convertit des fichiers image, données, audio ou vidéo vers un autre format (détection automatique du type selon l'extension).",
    en: 'Converts image, data, audio, or video files to another format (automatic type detection from the extension).',
  },
  'cli.filesArg': { fr: 'fichier(s) à convertir', en: 'file(s) to convert' },
  'cli.optTo': { fr: 'format de sortie', en: 'output format' },
  'cli.optCompress': { fr: 'compresser le(s) fichier(s) sans changer de format', en: 'compress the file(s) without changing format' },
  'cli.optCompressSuffix': { fr: ', au lieu de convertir avec -t', en: ', instead of converting with -t' },
  'cli.optLevel': { fr: 'niveau de compression : light, medium, strong', en: 'compression level: light, medium, strong' },
  'cli.optOutDir': { fr: 'dossier de sortie (par défaut : même dossier que le fichier source)', en: 'output directory (default: same directory as the source file)' },
  'cli.optQuality': { fr: 'qualité de compression pour jpg/webp/avif (1-100)', en: 'compression quality for jpg/webp/avif (1-100)' },
  'cli.optDensity': { fr: 'densité (DPI) utilisée pour rasteriser un SVG', en: 'density (DPI) used to rasterize an SVG' },
  'cli.optLang': { fr: 'langue des messages : fr ou en (défaut : détecté depuis $LANG)', en: 'message language: fr or en (default: detected from $LANG)' },

  'cli.errNeedToOrCompress': {
    fr: 'Erreur : précisez soit -t/--to <format> (conversion), soit -c/--compress (compression).',
    en: 'Error: specify either -t/--to <format> (conversion) or -c/--compress (compression).',
  },
  'cli.errToAndCompressExclusive': {
    fr: "Erreur : -t/--to et -c/--compress sont incompatibles, choisissez l'un ou l'autre.",
    en: 'Error: -t/--to and -c/--compress are mutually exclusive, pick one or the other.',
  },
  'cli.errUnrecognizedFileType': { fr: 'Type de fichier non reconnu : {{file}}', en: 'Unrecognized file type: {{file}}' },
  'cli.errSameFormat': { fr: "Le format de sortie ({{target}}) est identique au format d'entrée.", en: 'The output format ({{target}}) is the same as the input format.' },
  'cli.errImageFormatUnsupported': { fr: 'Format image non supporté: {{format}}', en: 'Image format not supported: {{format}}' },
  'cli.errDataFormatUnsupported': { fr: 'Format de données non supporté: {{format}}', en: 'Data format not supported: {{format}}' },
  'cli.errAudioFormatUnsupported': { fr: 'Format audio non supporté: {{format}}', en: 'Audio format not supported: {{format}}' },
  'cli.errVideoFormatUnsupported': { fr: 'Format vidéo non supporté: {{format}}', en: 'Video format not supported: {{format}}' },
  'cli.errSubtitleFormatUnsupported': { fr: 'Format de sous-titres non supporté: {{format}}', en: 'Subtitle format not supported: {{format}}' },
  'cli.errCompressUnsupportedType': { fr: 'Compression non supportée pour ce type de fichier : {{file}}', en: 'Compression not supported for this file type: {{file}}' },
  'cli.errUnrecognizedFileTypeInfo': { fr: 'Erreur : type de fichier non reconnu : {{file}}', en: 'Error: unrecognized file type: {{file}}' },
  'cli.errGeneric': { fr: 'Erreur : {{message}}', en: 'Error: {{message}}' },
  'cli.errUnrecognizedTypeOneOfTwo': { fr: "Erreur : un des deux fichiers a un type non reconnu par Anyform.", en: "Error: one of the two files has a type Anyform doesn't recognize." },
  'cli.errMustBeSameType': { fr: 'Erreur : les deux fichiers doivent être du même type pour être comparés.', en: 'Error: both files must be the same type to be compared.' },

  'cli.infoDescription': {
    fr: "affiche les propriétés d'un fichier (dimensions, durée, lignes/colonnes...) sans le modifier",
    en: "displays a file's properties (dimensions, duration, rows/columns...) without modifying it",
  },
  'cli.optJson': { fr: "affiche le résultat au format JSON plutôt qu'en texte lisible", en: 'outputs the result as JSON rather than human-readable text' },

  'cli.diffDescription': {
    fr: 'compare deux fichiers du même type (image : diff visuelle, données/sous-titres : diff ligne à ligne, reste : empreinte SHA-256)',
    en: 'compares two files of the same type (image: visual diff, data/subtitles: line-by-line diff, rest: SHA-256 fingerprint)',
  },
  'cli.optOut': {
    fr: 'fichier de sortie pour la diff (image : PNG ; texte : diff au format +/-). Par défaut : à côté de fileA',
    en: 'output file for the diff (image: PNG; text: +/- style diff). Default: next to fileA',
  },
  'cli.imagesIdentical': { fr: 'Images identiques.', en: 'Identical images.' },
  'cli.percentIdentical': { fr: '{{percent}}% des pixels identiques (zone commune).', en: '{{percent}}% of pixels identical (shared area).' },
  'cli.dimensionsMismatch': {
    fr: 'Dimensions différentes : A = {{a}}, B = {{b}} — comparaison faite sur leur zone commune.',
    en: 'Different dimensions: A = {{a}}, B = {{b}} — compared on their shared area.',
  },
  'cli.diffWritten': { fr: 'Diff écrite dans {{path}}', en: 'Diff written to {{path}}' },
  'cli.filesIdentical': { fr: 'Fichiers identiques.', en: 'Identical files.' },
  'cli.linesChanged': { fr: '{{added}} ligne(s) ajoutée(s), {{removed}} ligne(s) supprimée(s).', en: '{{added}} line(s) added, {{removed}} line(s) removed.' },
  'cli.hashIdentical': { fr: 'Fichiers identiques (même empreinte SHA-256).', en: 'Identical files (same SHA-256 fingerprint).' },
  'cli.filesDifferent': { fr: 'Fichiers différents.', en: 'Different files.' },
  'cli.tooLarge': {
    fr: 'Fichier trop volumineux pour une diff ligne à ligne détaillée — comparaison par empreinte seulement.',
    en: 'File too large for a detailed line-by-line diff — fingerprint comparison only.',
  },
  'cli.sizeHash': { fr: '{{label}} : {{size}} octets — SHA-256 {{hash}}', en: '{{label}}: {{size}} bytes — SHA-256 {{hash}}' },

  'inspect.durationUnknown': { fr: 'inconnue', en: 'unknown' },
  'inspect.errMediaUnreadable': {
    fr: 'Impossible de lire les métadonnées de ce fichier (corrompu ou format non supporté).',
    en: 'Unable to read this file\'s metadata (corrupted or unsupported format).',
  },
  'inspect.declaredDimensions': { fr: 'Dimensions déclarées', en: 'Declared dimensions' },
  'inspect.type': { fr: 'Type', en: 'Type' },
  'inspect.typeVector': { fr: 'SVG (vectoriel)', en: 'SVG (vector)' },
  'inspect.dimensions': { fr: 'Dimensions', en: 'Dimensions' },
  'inspect.ratio': { fr: 'Ratio', en: 'Ratio' },
  'inspect.format': { fr: 'Format', en: 'Format' },
  'inspect.note': { fr: 'Note', en: 'Note' },
  'inspect.heicNote': { fr: 'HEIC décodé pour lecture des dimensions (via heic-convert)', en: 'HEIC decoded to read dimensions (via heic-convert)' },
  'inspect.duration': { fr: 'Durée', en: 'Duration' },
  'inspect.resolution': { fr: 'Résolution', en: 'Resolution' },
  'inspect.avgBitrate': { fr: 'Débit moyen (estimé)', en: 'Average bitrate (estimated)' },
  'inspect.videoCodec': { fr: 'Codec vidéo', en: 'Video codec' },
  'inspect.id3.title': { fr: 'Titre', en: 'Title' },
  'inspect.id3.artist': { fr: 'Artiste', en: 'Artist' },
  'inspect.id3.album': { fr: 'Album', en: 'Album' },
  'inspect.id3.year': { fr: 'Année', en: 'Year' },
  'inspect.id3.genre': { fr: 'Genre', en: 'Genre' },
  'inspect.id3.cover': { fr: 'Pochette', en: 'Cover art' },
  'inspect.id3.coverPresent': { fr: 'Présente ({{mime}})', en: 'Present ({{mime}})' },
  'inspect.font.format': { fr: 'Format', en: 'Format' },
  'inspect.font.outlineFormat': { fr: 'Contours', en: 'Outlines' },
  'inspect.font.family': { fr: 'Famille', en: 'Family' },
  'inspect.font.glyphCount': { fr: 'Nombre de glyphes', en: 'Glyph count' },
  'inspect.font.tables': { fr: 'Tables', en: 'Tables' },
  'inspect.font.note': { fr: 'Note', en: 'Note' },
  'inspect.font.woff2LimitedNote': {
    fr: 'Aperçu limité (compression Brotli non décodée) : nom de famille non disponible',
    en: 'Limited preview (Brotli compression not decoded): family name unavailable',
  },
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
  'inspect.sampleRate': { fr: "Fréquence d'échantillonnage", en: 'Sample rate' },
  'inspect.aspectRatio': { fr: "Format d'image", en: 'Aspect ratio' },
  'inspect.columnTypes': { fr: 'Type dominant par colonne', en: 'Dominant type per column' },
  'inspect.type.number': { fr: 'Nombre', en: 'Number' },
  'inspect.type.date': { fr: 'Date', en: 'Date' },
  'inspect.type.text': { fr: 'Texte', en: 'Text' },

  'inspect.exif.camera': { fr: 'Appareil', en: 'Camera' },
  'inspect.exif.lens': { fr: 'Objectif', en: 'Lens' },
  'inspect.exif.dateTaken': { fr: 'Date de prise de vue', en: 'Date taken' },
  'inspect.exif.orientation': { fr: 'Orientation', en: 'Orientation' },
  'inspect.exif.orientation.normal': { fr: 'Normale', en: 'Normal' },
  'inspect.exif.orientation.flipped': { fr: 'Miroir horizontal', en: 'Flipped horizontally' },
  'inspect.exif.orientation.rotated180': { fr: 'Rotation 180°', en: 'Rotated 180°' },
  'inspect.exif.orientation.flippedRotated180': { fr: 'Miroir + rotation 180°', en: 'Flipped + rotated 180°' },
  'inspect.exif.orientation.flippedRotated90cw': { fr: 'Miroir + rotation 90° horaire', en: 'Flipped + rotated 90° CW' },
  'inspect.exif.orientation.rotated90cw': { fr: 'Rotation 90° horaire', en: 'Rotated 90° CW' },
  'inspect.exif.orientation.flippedRotated90ccw': { fr: 'Miroir + rotation 90° antihoraire', en: 'Flipped + rotated 90° CCW' },
  'inspect.exif.orientation.rotated90ccw': { fr: 'Rotation 90° antihoraire', en: 'Rotated 90° CCW' },
  'inspect.exif.fNumber': { fr: 'Ouverture', en: 'Aperture' },
  'inspect.exif.exposureTime': { fr: "Temps d'exposition", en: 'Exposure time' },
  'inspect.exif.iso': { fr: 'Sensibilité ISO', en: 'ISO' },
  'inspect.exif.focalLength': { fr: 'Focale', en: 'Focal length' },
  'inspect.exif.gps': { fr: 'Position GPS', en: 'GPS location' },

  'inspect.pdf.version': { fr: 'Version PDF', en: 'PDF version' },
  'inspect.pdf.pages': { fr: 'Pages', en: 'Pages' },
  'inspect.pdf.title': { fr: 'Titre', en: 'Title' },
  'inspect.pdf.author': { fr: 'Auteur', en: 'Author' },
  'inspect.pdf.creator': { fr: 'Créateur', en: 'Creator' },
  'inspect.pdf.producer': { fr: 'Producteur', en: 'Producer' },
  'inspect.pdf.created': { fr: 'Date de création', en: 'Creation date' },
  'inspect.pdf.encrypted': { fr: 'Chiffré', en: 'Encrypted' },
  'inspect.pdf.hasText': { fr: 'Texte sélectionnable', en: 'Selectable text' },
  'inspect.pdf.hasText.likely': { fr: 'Probablement (police détectée)', en: 'Likely (font detected)' },
  'inspect.pdf.hasText.unlikely': { fr: 'Probablement pas (aucune police détectée, possible scan)', en: 'Probably not (no font detected, possibly scanned)' },

  'inspect.zip.fileCount': { fr: 'Nombre de fichiers', en: 'Number of files' },
  'inspect.zip.folderCount': { fr: 'Nombre de dossiers', en: 'Number of folders' },
  'inspect.zip.uncompressedSize': { fr: 'Taille décompressée', en: 'Uncompressed size' },
  'inspect.zip.compressedSize': { fr: 'Taille compressée', en: 'Compressed size' },
  'inspect.zip.ratio': { fr: 'Taux de compression', en: 'Compression ratio' },
  'inspect.zip.detectedType': { fr: 'Type détecté', en: 'Detected type' },
  'inspect.zip.type.office': { fr: 'Document Office (docx/xlsx/pptx)', en: 'Office document (docx/xlsx/pptx)' },
  'inspect.zip.type.jar': { fr: 'Archive Java (JAR)', en: 'Java archive (JAR)' },
  'inspect.zip.type.epub': { fr: 'Livre EPUB', en: 'EPUB book' },
  'inspect.zip.fileList': { fr: 'Fichiers', en: 'Files' },
  'inspect.zip.andMore': { fr: ' et {{n}} de plus', en: ' and {{n}} more' },
  'inspect.zip.invalid': { fr: 'Archive illisible', en: 'Unreadable archive' },

  'inspect.name': { fr: 'Nom', en: 'Name' },
  'inspect.size': { fr: 'Taille', en: 'Size' },
  'inspect.lastModified': { fr: 'Dernière modification', en: 'Last modified' },

  'convert.errOutputFormatUnsupported': { fr: 'Format de sortie non supporté: {{format}}', en: 'Output format not supported: {{format}}' },
  'convert.errCompressUnsupported': {
    fr: 'Format non compressible : {{ext}}. Formats supportés : {{supported}}, heic, heif.',
    en: 'Format not compressible: {{ext}}. Supported formats: {{supported}}, heic, heif.',
  },
  'media.errFfmpegFailed': { fr: 'ffmpeg a échoué (code {{code}}):\n{{stderr}}', en: 'ffmpeg failed (code {{code}}):\n{{stderr}}' },
  'media.errVideoCompressUnsupported': { fr: 'Compression vidéo non supportée pour .{{ext}}.', en: 'Video compression not supported for .{{ext}}.' },
  'media.errAudioCompressUnsupported': { fr: 'Compression audio non supportée pour .{{ext}}.', en: 'Audio compression not supported for .{{ext}}.' },
  'subtitles.errFormatUnsupported': { fr: 'Format de sous-titres non supporté : {{format}}', en: 'Subtitle format not supported: {{format}}' },
  'subtitles.errUnrecognized': {
    fr: 'Aucun sous-titre reconnu dans ce fichier — vérifie que le format est valide.',
    en: 'No subtitle recognized in this file — check that the format is valid.',
  },
};

/**
 * Détermine la langue des messages CLI, dans l'ordre de priorité : --lang=xx / --lang xx
 * en argument de ligne de commande, puis $LC_ALL/$LANG/$LANGUAGE, puis français par défaut.
 * Appelée une seule fois au chargement du module (voir `currentLang` ci-dessous) — voir le
 * commentaire d'en-tête pour pourquoi il n'y a pas de sélecteur en direct comme sur le web.
 * @returns {'fr'|'en'}
 */
function detectLanguage() {
  const eqArg = process.argv.find((a) => a.startsWith('--lang='));
  if (eqArg) {
    const v = eqArg.split('=')[1].toLowerCase();
    if (v === 'en' || v === 'fr') return v;
  }
  const idx = process.argv.indexOf('--lang');
  if (idx !== -1 && process.argv[idx + 1]) {
    const v = process.argv[idx + 1].toLowerCase();
    if (v === 'en' || v === 'fr') return v;
  }
  const envLang = (process.env.LC_ALL || process.env.LANG || process.env.LANGUAGE || '').toLowerCase();
  return envLang.startsWith('en') ? 'en' : 'fr';
}

const currentLang = detectLanguage();

// Langue détectée une fois au démarrage, exposée aux autres modules (inspect.js s'en sert
// pour choisir le format de date/nombre local, ex. toLocaleString('fr-FR' | 'en-US')).
function getLanguage() {
  return currentLang;
}

/**
 * Traduit une clé de message dans la langue courante, avec substitution de variables
 * ("{{var}}" dans la chaîne). Retombe sur le français si la traduction anglaise manque, et
 * sur la clé elle-même si la clé n'existe pas du tout dans STRINGS (plutôt que de planter).
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
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

module.exports = { t, getLanguage };
