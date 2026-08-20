// Listes de formats identiques en entrée et en sortie (contrairement à image/vidéo, qui ont
// chacune un format supplémentaire réservé à la sortie — voir getOutputFormatOptions) :
// partagées entre INPUT_FORMAT_OPTIONS et getOutputFormatOptions pour n'avoir qu'un seul
// endroit à mettre à jour si un format est ajouté/retiré.
const DATA_FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'xlsx', label: 'XLSX' },
];
const AUDIO_FORMAT_OPTIONS = [
  { value: 'wav', label: 'WAV' },
  { value: 'mp3', label: 'MP3' },
  { value: 'ogg', label: 'OGG' },
  { value: 'm4a', label: 'M4A' },
  { value: 'flac', label: 'FLAC' },
  { value: 'aac', label: 'AAC' },
  { value: 'wma', label: 'WMA' },
  { value: 'opus', label: 'Opus' },
];
const SUBTITLE_FORMAT_OPTIONS = [
  { value: 'srt', label: 'SRT' },
  { value: 'vtt', label: 'VTT' },
  { value: 'ass', label: 'ASS' },
];

// Formats d'entrée proposés par catégorie pour le Convertisseur/Compresseur. Ne couvre pas
// tous les formats qu'Anyform sait lire (voir INSPECT_ONLY_EXTS plus bas) : uniquement ceux
// qu'on peut aussi reconvertir en sortie depuis le navigateur.
const INPUT_FORMAT_OPTIONS = {
  image: [
    { value: 'svg', label: 'SVG' },
    { value: 'png', label: 'PNG' },
    { value: 'jpg', label: 'JPG' },
    { value: 'webp', label: 'WebP' },
    { value: 'gif', label: 'GIF' },
    { value: 'bmp', label: 'BMP' },
    { value: 'heic', label: 'HEIC' },
  ],
  data: DATA_FORMAT_OPTIONS,
  audio: AUDIO_FORMAT_OPTIONS,
  video: [
    { value: 'mp4', label: 'MP4' },
    { value: 'webm', label: 'WebM' },
    { value: 'mov', label: 'MOV' },
    { value: 'mkv', label: 'MKV' },
    { value: 'avi', label: 'AVI' },
    { value: 'flv', label: 'FLV' },
    { value: 'ogv', label: 'OGV' },
  ],
  subtitle: SUBTITLE_FORMAT_OPTIONS,
};

// Fonction plutôt que constante : les deux labels non-universels (SVG vectorisation, GIF
// animé) doivent se retraduire à chaque appel, pas seulement au chargement de la page — un
// changement de langue en cours de session doit aussi les mettre à jour.
function getOutputFormatOptions() {
  return {
    image: [
      { value: 'png', label: 'PNG' },
      { value: 'jpg', label: 'JPG' },
      { value: 'webp', label: 'WebP' },
      { value: 'avif', label: 'AVIF' },
      { value: 'ico', label: 'ICO' },
      { value: 'tiff', label: 'TIFF' },
      { value: 'svg', label: t('format.svgVector') },
    ],
    data: DATA_FORMAT_OPTIONS,
    audio: AUDIO_FORMAT_OPTIONS,
    video: [
      { value: 'mp4', label: 'MP4' },
      { value: 'webm', label: 'WebM' },
      { value: 'mov', label: 'MOV' },
      { value: 'mkv', label: 'MKV' },
      { value: 'avi', label: 'AVI' },
      { value: 'flv', label: 'FLV' },
      { value: 'ogv', label: 'OGV' },
      { value: 'gif', label: t('format.gifAnimated') },
    ],
    subtitle: SUBTITLE_FORMAT_OPTIONS,
  };
}

// Formats compressibles par catégorie (sous-ensemble des formats convertibles, plus
// "document" qui n'existe que pour la compression PDF — voir onModeChange).
const COMPRESS_FORMATS = {
  image: ['png', 'jpg', 'webp', 'heic', 'svg'],
  audio: ['wav', 'mp3', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'opus'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv', 'ogv'],
  document: ['pdf'],
};

const modeTabs = document.getElementById('modeTabs');
const categoryField = document.getElementById('categoryField');
const categoryTabs = document.getElementById('categoryTabs');
const sourceFormatSelect = document.getElementById('sourceFormat');
const formatRow = document.getElementById('formatRow');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const formatSelect = document.getElementById('format');
const compressionRow = document.getElementById('compressionRow');
const compressionLevelSelect = document.getElementById('compressionLevel');
const convertBtn = document.getElementById('convertBtn');
const convertBtnLabel = convertBtn.querySelector('.btn-label');
const statusEl = document.getElementById('status');
const previewRow = document.getElementById('previewRow');
const previewBefore = document.getElementById('previewBefore');
const previewAfter = document.getElementById('previewAfter');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const resultCard = document.getElementById('resultCard');
const resultName = document.getElementById('resultName');
const resultMeta = document.getElementById('resultMeta');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const inspectResult = document.getElementById('inspectResult');
const inspectList = document.getElementById('inspectList');
const compareDropzones = document.getElementById('compareDropzones');
const dropzoneA = document.getElementById('dropzoneA');
const dropzoneB = document.getElementById('dropzoneB');
const fileInputA = document.getElementById('fileInputA');
const fileInputB = document.getElementById('fileInputB');
const fileNameA = document.getElementById('fileNameA');
const fileNameB = document.getElementById('fileNameB');
const compareResult = document.getElementById('compareResult');
const langFrBtn = document.getElementById('langFr');
const langEnBtn = document.getElementById('langEn');

let selectedFile = null;
let previewBeforeUrl = null;
let previewAfterUrl = null;
let resultBlob = null;
let resultUrl = null;
let resultFileName = '';
let selectedInspectFile = null;
let selectedCompareFileA = null;
let selectedCompareFileB = null;
let compareDiffUrl = null; // object URL du dernier PNG de diff, à révoquer avant d'en créer un autre
let currentModeValue = modeTabs.querySelector('.tab[aria-selected="true"]')?.dataset.mode || 'convert';
let currentCategoryValue = categoryTabs.querySelector('.tab[aria-selected="true"]')?.dataset.category || 'image';

/** Catégorie de fichier actuellement sélectionnée (image/données/audio/vidéo/...). */
function currentCategory() {
  return currentCategoryValue;
}

/** Vrai si l'onglet Compresseur est actif. */
function isCompressing() {
  return currentModeValue === 'compress';
}

/** Vrai si l'onglet Inspecteur est actif. */
function isInspectMode() {
  return currentModeValue === 'inspect';
}

/** Vrai si l'onglet Comparateur est actif. */
function isCompareMode() {
  return currentModeValue === 'compare';
}

// Déduit la catégorie (image/données/audio/vidéo/sous-titres) d'une extension à partir de
// INPUT_FORMAT_OPTIONS, plutôt que de dupliquer la liste — utilisé par l'Inspecteur et le
// Comparateur, qui n'ont pas d'onglet "Type de fichier" et détectent tout depuis le fichier
// déposé.
function categoryOfExt(ext) {
  for (const [category, options] of Object.entries(INPUT_FORMAT_OPTIONS)) {
    if (options.some((opt) => opt.value === ext)) return category;
  }
  return null;
}

// L'Inspecteur reconnaît des formats de plus que le Convertisseur : TIFF/ICO/AVIF sont des
// formats de sortie chez nous (Canvas ne sait pas forcément les recharger en entrée pour une
// conversion), et PDF/ZIP ne sont pas du tout des formats qu'Anyform convertit — mais les
// inspecter n'a besoin que de lire leurs métadonnées, pas de les (re)convertir.
const INSPECT_ONLY_EXTS = {
  tiff: 'image',
  tif: 'image',
  ico: 'image',
  avif: 'image',
  pdf: 'document',
  zip: 'archive',
  ttf: 'font',
  otf: 'font',
  woff: 'font',
  woff2: 'font',
};

/** Catégorie d'une extension pour l'Inspecteur : celles du Convertisseur + INSPECT_ONLY_EXTS. */
function inspectCategoryOfExt(ext) {
  return categoryOfExt(ext) || INSPECT_ONLY_EXTS[ext] || null;
}

const BYTE_UNITS = { fr: ['o', 'Ko', 'Mo', 'Go'], en: ['B', 'KB', 'MB', 'GB'] };

/** Formate une taille en octets dans l'unité la plus lisible, localisée (fr/en). */
function formatBytes(bytes) {
  const units = BYTE_UNITS[getLanguage()] || BYTE_UNITS.fr;
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  let value = bytes / 1024;
  let unitIndex = 1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

/** Affiche un message de statut sous le bouton principal, avec une classe CSS (ex. 'error'). */
function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

/**
 * Affiche la barre de progression en mode indéterminé (35% fixe, pas d'animation de
 * pourcentage) : utilisé pendant le chargement du moteur ffmpeg.wasm, avant que la
 * conversion elle-même ne démarre et ne fournisse une vraie progression via updateProgress.
 */
function showProgress(label) {
  progressWrap.hidden = false;
  progressBar.classList.add('indeterminate');
  progressBar.style.width = '35%';
  progressLabel.textContent = label;
}

/** Bascule la barre de progression en mode déterminé et affiche le pourcentage réel. */
function updateProgress(percent) {
  progressBar.classList.remove('indeterminate');
  progressBar.style.width = `${percent}%`;
  progressLabel.textContent = `${percent}%`;
}

/** Masque et réinitialise la barre de progression. */
function hideProgress() {
  progressWrap.hidden = true;
  progressBar.classList.remove('indeterminate');
  progressBar.style.width = '0%';
}

/** Masque la carte de résultat et libère l'object URL du blob résultat précédent. */
function hideResult() {
  resultCard.hidden = true;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  resultBlob = null;
}

/**
 * Affiche la carte de résultat pour un blob produit par une conversion/compression.
 * originalSize, quand fourni (mode Compresseur), permet d'afficher le gain de taille ;
 * sans lui (mode Convertisseur, où la taille change pour d'autres raisons que la
 * compression), on affiche juste la taille finale.
 */
function showResult(blob, fileName, originalSize = null) {
  resultBlob = blob;
  resultFileName = fileName;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = URL.createObjectURL(blob);
  resultName.textContent = fileName;

  if (originalSize) {
    const percent = Math.round(((originalSize - blob.size) / originalSize) * 100);
    resultMeta.textContent =
      percent > 0
        ? t('result.sizeChange', { before: formatBytes(originalSize), after: formatBytes(blob.size), percent })
        : t('result.alreadyOptimized', { before: formatBytes(originalSize), after: formatBytes(blob.size) });
  } else {
    resultMeta.textContent = formatBytes(blob.size);
  }

  resultCard.hidden = false;
}

/**
 * Déclenche le téléchargement d'un blob via un <a download> éphémère — la façon standard de
 * forcer un téléchargement depuis du JS sans passer par l'API chrome.downloads (pas besoin
 * de permission supplémentaire dans le manifest, et fonctionne aussi pour l'historique).
 */
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Reconstruit la liste d'historique dans le DOM à partir des entrées stockées. */
function renderHistory(entries) {
  historySection.hidden = entries.length === 0;
  historyList.innerHTML = '';

  for (const entry of entries) {
    const li = document.createElement('li');
    li.className = 'history-item';

    const info = document.createElement('div');
    info.className = 'history-info';
    const name = document.createElement('p');
    name.className = 'history-name';
    name.textContent = entry.name;
    const meta = document.createElement('p');
    meta.className = 'history-meta';
    meta.textContent = entry.originalSize
      ? `${formatBytes(entry.originalSize)} → ${formatBytes(entry.size)}`
      : formatBytes(entry.size);
    info.append(name, meta);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-ghost btn-small';
    btn.textContent = t('btn.download');
    btn.addEventListener('click', () => downloadBlob(entry.blob, entry.name));

    li.append(info, btn);
    historyList.appendChild(li);
  }
}

clearHistoryBtn.addEventListener('click', () => {
  clearHistory().then(() => renderHistory([]));
});

// Chargement initial de l'historique depuis chrome.storage.local (voir history.js) ; le
// catch silencieux évite qu'un historique corrompu/absent ne bloque le reste de la popup.
getHistoryEntries().then(renderHistory).catch(() => {});

// Le bouton principal ne se réactive que si l'entrée requise par le mode courant est
// prête : un fichier pour Convertisseur/Compresseur/Inspecteur, deux pour Comparateur.
function hasRequiredInput() {
  if (isInspectMode()) return Boolean(selectedInspectFile);
  if (isCompareMode()) return Boolean(selectedCompareFileA && selectedCompareFileB);
  return Boolean(selectedFile);
}

/** Réévalue si le bouton principal doit être actif, sans toucher au reste de l'UI. */
function updateConvertBtnEnabled() {
  convertBtn.disabled = !hasRequiredInput();
}

/**
 * Verrouille l'UI pendant une conversion/compression/inspection/comparaison en cours :
 * empêche de changer d'onglet, de format ou de déposer un nouveau fichier tant que
 * l'opération (potentiellement longue avec ffmpeg.wasm) n'est pas terminée.
 */
function setBusy(busy) {
  convertBtn.disabled = busy || !hasRequiredInput();
  convertBtn.classList.toggle('is-loading', busy);
  for (const tab of categoryTabs.querySelectorAll('.tab')) tab.disabled = busy;
  for (const tab of modeTabs.querySelectorAll('.tab')) tab.disabled = busy;
  sourceFormatSelect.disabled = busy;
  formatSelect.disabled = busy;
  compressionLevelSelect.disabled = busy;
  dropzone.classList.toggle('is-disabled', busy);
  dropzoneA.classList.toggle('is-disabled', busy);
  dropzoneB.classList.toggle('is-disabled', busy);
}

/**
 * Repeuple un <select> avec de nouvelles options. preserveSelection tente de garder la
 * valeur précédente si elle existe toujours dans la nouvelle liste (ex. changement de
 * langue qui ne modifie que des libellés) ; sinon, retombe sur le premier choix — cas d'un
 * changement de catégorie où l'ancienne valeur n'a aucun sens dans la nouvelle liste.
 */
function populateSelect(selectEl, options, { preserveSelection = false } = {}) {
  const previousValue = selectEl.value;

  selectEl.innerHTML = '';
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    selectEl.appendChild(el);
  }

  if (preserveSelection && options.some((opt) => opt.value === previousValue)) {
    selectEl.value = previousValue;
  } else {
    selectEl.selectedIndex = 0;
  }
}

/**
 * Restreint l'attribut accept du <input type=file> selon le mode courant, pour filtrer les
 * fichiers proposés par le sélecteur natif du navigateur (le drag & drop, lui, n'est pas
 * filtré par le navigateur : la validation réelle reste faite dans setFile/setInspectFile).
 */
function updateAcceptedFileType() {
  if (isInspectMode()) {
    // Pas de catégorie pré-choisie en mode Inspecteur (voir categoryOfExt) : n'importe
    // quel format reconnu par Anyform est accepté, la détection se fait après coup.
    fileInput.accept = '';
  } else if (isCompressing()) {
    const allowed = COMPRESS_FORMATS[currentCategory()] || [];
    fileInput.accept = allowed.map((ext) => `.${ext}`).join(',');
  } else {
    fileInput.accept = `.${sourceFormatSelect.value}`;
  }
}

/**
 * Repeuple la liste des formats de sortie pour la catégorie courante, en excluant le format
 * d'entrée sélectionné : convertir un fichier vers son propre format n'a pas de sens et
 * n'est proposé nulle part dans l'UI.
 */
function refreshOutputOptions() {
  const category = currentCategory();
  const sourceExt = sourceFormatSelect.value;
  const options = getOutputFormatOptions()[category].filter((opt) => opt.value !== sourceExt);
  populateSelect(formatSelect, options, { preserveSelection: true });
}

/** Marque comme actif (aria-selected + classe CSS) l'onglet dont le dataset correspond à value. */
function setActiveTab(tabsEl, datasetKey, value) {
  for (const tab of tabsEl.querySelectorAll('.tab')) {
    const isActive = tab.dataset[datasetKey] === value;
    tab.setAttribute('aria-selected', String(isActive));
    tab.classList.toggle('is-active', isActive);
  }
}

/** Gère le changement d'onglet Type de fichier : reconfigure formats et UI dépendante. */
function onCategoryChange(category) {
  currentCategoryValue = category;
  setActiveTab(categoryTabs, 'category', category);
  // "document" n'a pas d'entrée dans INPUT_FORMAT_OPTIONS (compress-only, rien à
  // convertir) : pas de format d'entrée/sortie à peupler pour elle, la ligne correspondante
  // reste de toute façon cachée en mode Compresseur (voir onModeChange).
  if (INPUT_FORMAT_OPTIONS[category]) {
    populateSelect(sourceFormatSelect, INPUT_FORMAT_OPTIONS[category]);
    refreshOutputOptions();
  }
  syncUiForCategory();
}

// Libellé du bouton principal par mode — recalculé aussi au changement de langue (voir
// l'écouteur 'anyform:langchange' plus bas) puisqu'il ne passe pas par data-i18n statique.
const MODE_LABEL_KEYS = { convert: 'mode.convert.btn', compress: 'mode.compress.btn', inspect: 'mode.inspect.btn', compare: 'mode.compare.btn' };

/**
 * Gère le changement d'onglet Convertisseur/Compresseur/Inspecteur/Comparateur : montre et
 * cache les blocs d'UI propres à chaque mode (formats, niveau de compression, dropzone
 * simple ou double, onglets de catégorie disponibles) et réinitialise l'état du mode quitté.
 */
function onModeChange(mode) {
  currentModeValue = mode;
  setActiveTab(modeTabs, 'mode', mode);
  convertBtnLabel.textContent = t(MODE_LABEL_KEYS[mode]);

  const compressing = isCompressing();
  const inspecting = isInspectMode();
  const comparing = isCompareMode();

  // Champs propres au Convertisseur/Compresseur, sans objet en Inspecteur/Comparateur.
  formatRow.hidden = compressing || inspecting || comparing;
  compressionRow.hidden = !compressing;

  // L'Inspecteur et le Comparateur détectent le type de fichier depuis ce qui est déposé
  // (voir categoryOfExt) plutôt que de demander à le choisir à l'avance — pas besoin de
  // configurer un format de sortie ou une liste de formats compressibles pour eux, donc
  // les onglets Type de fichier n'ont pas de rôle à jouer dans ces deux modes.
  categoryField.hidden = inspecting || comparing;

  // Une seule entrée (dropzone classique) pour tous les modes sauf le Comparateur, qui en
  // a besoin de deux (fichier A / fichier B) affichées côte à côte à la place.
  dropzone.hidden = comparing;
  compareDropzones.hidden = !comparing;

  hideResult();
  inspectResult.hidden = true;
  compareResult.hidden = true;
  if (inspecting || comparing) previewRow.hidden = true;

  if (compressing && !COMPRESS_FORMATS[currentCategory()]) {
    currentCategoryValue = 'image';
    setActiveTab(categoryTabs, 'category', 'image');
    populateSelect(sourceFormatSelect, INPUT_FORMAT_OPTIONS.image);
    refreshOutputOptions();
  }

  // "document" (PDF) n'existe que côté Compresseur : pas dans INPUT_FORMAT_OPTIONS (rien à
  // convertir), donc cet onglet doit rester caché en mode Convertisseur — d'où le test sur
  // INPUT_FORMAT_OPTIONS plutôt qu'un simple "toujours visible hors compression".
  for (const tab of categoryTabs.querySelectorAll('.tab')) {
    const category = tab.dataset.category;
    tab.hidden = compressing ? !COMPRESS_FORMATS[category] : !INPUT_FORMAT_OPTIONS[category];
  }

  if (comparing) {
    resetCompare();
  } else {
    syncUiForCategory();
  }
}

/** Réinitialise le fichier sélectionné et l'attribut accept quand catégorie ou mode changent. */
function syncUiForCategory() {
  updateAcceptedFileType();
  if (isInspectMode()) {
    setInspectFile(null);
  } else {
    setFile(null);
  }
}

/**
 * Définit le fichier actif du Convertisseur/Compresseur, valide son extension contre le
 * format d'entrée choisi (ou la liste des formats compressibles en mode Compresseur), et met
 * à jour aperçu/statut/bouton en conséquence.
 */
function setFile(file) {
  selectedFile = file;
  fileNameEl.textContent = file ? file.name : '';
  hideResult();
  hideProgress();

  if (previewBeforeUrl) URL.revokeObjectURL(previewBeforeUrl);
  if (previewAfterUrl) URL.revokeObjectURL(previewAfterUrl);
  previewAfterUrl = null;
  previewAfter.removeAttribute('src');

  if (!file) {
    previewRow.hidden = true;
    convertBtn.disabled = true;
    setStatus('');
    return;
  }

  const category = currentCategory();
  const ext = extensionOf(file);

  if (isCompressing()) {
    const allowed = COMPRESS_FORMATS[category] || [];
    if (!allowed.includes(ext)) {
      previewRow.hidden = true;
      convertBtn.disabled = true;
      setStatus(
        t('error.formatNotSupportedCompress', { ext: ext || '?', allowed: allowed.map((f) => f.toUpperCase()).join(', ') }),
        'error'
      );
      return;
    }
  } else {
    const expectedExt = sourceFormatSelect.value;
    if (ext !== expectedExt) {
      previewRow.hidden = true;
      convertBtn.disabled = true;
      setStatus(t('error.wrongInputFormat', { ext: ext || '?', expected: expectedExt }), 'error');
      return;
    }
  }

  if (category === 'image') {
    previewBeforeUrl = URL.createObjectURL(file);
    previewBefore.src = previewBeforeUrl;
    previewRow.hidden = false;
  } else {
    previewRow.hidden = true;
  }

  convertBtn.disabled = false;
  setStatus('');
}

// Mode Inspecteur : contrairement à setFile (Convertisseur/Compresseur), pas de catégorie
// pré-choisie à valider contre le fichier déposé — la catégorie est déduite de son
// extension via categoryOfExt. Rejette juste les extensions qu'Anyform ne connaît pas.
function setInspectFile(file) {
  selectedInspectFile = file;
  fileNameEl.textContent = file ? file.name : '';
  inspectResult.hidden = true;

  if (!file) {
    updateConvertBtnEnabled();
    setStatus('');
    return;
  }

  const ext = extensionOf(file);
  if (!inspectCategoryOfExt(ext)) {
    selectedInspectFile = null;
    updateConvertBtnEnabled();
    setStatus(t('error.unrecognizedFormat', { ext: ext || '?' }), 'error');
    return;
  }

  updateConvertBtnEnabled();
  setStatus('');
}

/** Affiche les métadonnées extraites par l'Inspecteur sous forme de liste de définitions. */
function renderInspectResult(items) {
  inspectList.innerHTML = '';
  for (const item of items) {
    const dt = document.createElement('dt');
    dt.textContent = item.label;
    const dd = document.createElement('dd');
    dd.textContent = item.value;
    inspectList.append(dt, dd);
  }
  inspectResult.hidden = false;
}

// Mode Comparateur : deux dropzones indépendantes (A/B) au lieu d'une seule. La catégorie
// n'est connue qu'une fois les deux fichiers déposés (voir updateCompareCategoryStatus),
// pas choisie à l'avance comme pour le Convertisseur/Compresseur.
function setCompareFile(slot, file) {
  if (slot === 'A') {
    selectedCompareFileA = file;
    fileNameA.textContent = file ? file.name : '';
  } else {
    selectedCompareFileB = file;
    fileNameB.textContent = file ? file.name : '';
  }
  compareResult.hidden = true;
  updateCompareCategoryStatus();
  updateConvertBtnEnabled();
}

// Vérifie que les deux fichiers déposés sont de la même catégorie (comparer un CSV et une
// vidéo n'a pas de sens) et affiche une erreur explicite sinon, sans bloquer la sélection
// elle-même — l'utilisateur peut toujours remplacer l'un des deux fichiers pour corriger.
function updateCompareCategoryStatus() {
  if (!selectedCompareFileA || !selectedCompareFileB) {
    setStatus('');
    return;
  }
  const categoryA = categoryOfExt(extensionOf(selectedCompareFileA));
  const categoryB = categoryOfExt(extensionOf(selectedCompareFileB));

  if (!categoryA || !categoryB) {
    setStatus(t('error.compareUnrecognizedType'), 'error');
    return;
  }
  if (categoryA !== categoryB) {
    setStatus(t('error.compareDifferentTypes'), 'error');
    return;
  }
  setStatus('');
}

/** Vide les deux emplacements du Comparateur (appelé en entrant dans ce mode). */
function resetCompare() {
  selectedCompareFileA = null;
  selectedCompareFileB = null;
  fileNameA.textContent = '';
  fileNameB.textContent = '';
  compareResult.hidden = true;
  updateConvertBtnEnabled();
  setStatus('');
}

/**
 * Affiche le résultat du Comparateur selon son type : diff visuelle pour les images
 * ('image'), diff ligne à ligne pour les fichiers texte reconnus ('text'), ou simple
 * comparaison d'empreinte SHA-256 pour tout le reste ('hash' — audio/vidéo/xlsx/fichiers
 * texte trop volumineux). Le rendu diffère significativement d'un type à l'autre, d'où le
 * découpage en trois branches plutôt qu'un template unique.
 */
function renderCompareResult(result) {
  compareResult.innerHTML = '';
  compareResult.hidden = false;

  const summary = document.createElement('p');
  summary.className = 'compare-summary';

  if (result.type === 'image') {
    summary.textContent = result.identical
      ? t('compare.imagesIdentical')
      : t('compare.percentIdentical', { percent: result.percentIdentical });
    compareResult.appendChild(summary);

    if (result.sizeMismatch) {
      const note = document.createElement('p');
      note.className = 'compare-note';
      note.textContent = t('compare.dimensionsMismatch', { a: result.dimensionsA, b: result.dimensionsB });
      compareResult.appendChild(note);
    }

    if (compareDiffUrl) URL.revokeObjectURL(compareDiffUrl);
    compareDiffUrl = URL.createObjectURL(result.diffBlob);
    const img = document.createElement('img');
    img.className = 'compare-diff-image';
    img.src = compareDiffUrl;
    img.alt = t('compare.diffImageAlt');
    compareResult.appendChild(img);

    const downloadDiffBtn = document.createElement('button');
    downloadDiffBtn.type = 'button';
    downloadDiffBtn.className = 'btn-secondary';
    downloadDiffBtn.textContent = t('btn.downloadDiff');
    downloadDiffBtn.addEventListener('click', () => downloadBlob(result.diffBlob, 'diff.png'));
    compareResult.appendChild(downloadDiffBtn);
    return;
  }

  if (result.type === 'text') {
    summary.textContent = result.identical
      ? t('compare.filesIdentical')
      : t('compare.linesChanged', { added: result.added, removed: result.removed });
    compareResult.appendChild(summary);

    const list = document.createElement('div');
    list.className = 'compare-diff-lines';
    for (const line of result.diff) {
      if (line.type === 'equal') continue; // seules les lignes qui changent sont affichées
      const row = document.createElement('div');
      row.className = `compare-diff-line compare-diff-line--${line.type}`;
      row.textContent = `${line.type === 'added' ? '+' : '-'} ${line.text}`;
      list.appendChild(row);
    }
    compareResult.appendChild(list);
    return;
  }

  // type === 'hash' : comparaison par empreinte SHA-256 uniquement (audio/vidéo/xlsx, ou
  // fichier texte trop volumineux pour une diff ligne à ligne détaillée).
  summary.textContent = result.identical ? t('compare.hashIdentical') : t('compare.filesDifferent');
  compareResult.appendChild(summary);

  if (result.tooLarge) {
    const note = document.createElement('p');
    note.className = 'compare-note';
    note.textContent = t('compare.tooLarge');
    compareResult.appendChild(note);
  }

  const details = document.createElement('p');
  details.className = 'compare-note';
  details.textContent = t('compare.sizeHash', { label: 'A', size: formatBytes(result.sizeA), hash: result.hashA.slice(0, 16) });
  compareResult.appendChild(details);
  const detailsB = document.createElement('p');
  detailsB.className = 'compare-note';
  detailsB.textContent = t('compare.sizeHash', { label: 'B', size: formatBytes(result.sizeB), hash: result.hashB.slice(0, 16) });
  compareResult.appendChild(detailsB);
}

// Câblage des onglets Type de fichier et Mode : chaque bouton porte sa valeur dans son
// dataset plutôt qu'un écouteur dédié par onglet, pour ne pas dupliquer la logique.
for (const tab of categoryTabs.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => onCategoryChange(tab.dataset.category));
}

for (const tab of modeTabs.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => onModeChange(tab.dataset.mode));
}

// Changer le format d'entrée change aussi les formats de sortie proposés (on ne peut pas
// convertir vers son propre format) et invalide le fichier déjà sélectionné s'il ne
// correspond plus au nouveau format d'entrée choisi (re-validation via setFile).
sourceFormatSelect.addEventListener('change', () => {
  updateAcceptedFileType();
  refreshOutputOptions();
  setFile(selectedFile);
});

// Le mode courant décide qui reçoit le fichier déposé sur la dropzone principale :
// Convertisseur/Compresseur (setFile, validé contre la catégorie choisie) ou Inspecteur
// (setInspectFile, catégorie déduite du fichier lui-même).
function handleIncomingFile(file) {
  if (!file) return;
  if (isInspectMode()) setInspectFile(file);
  else setFile(file);
}

// Câble une zone de glisser-déposer (clic, clavier, drag & drop, <input type=file>) sur un
// gestionnaire commun — utilisé pour la dropzone principale et pour les deux du
// Comparateur, qui ont exactement le même comportement d'interaction.
function wireDropzone(zoneEl, inputEl, onFile) {
  zoneEl.addEventListener('click', () => inputEl.click());
  zoneEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputEl.click();
    }
  });

  inputEl.addEventListener('change', () => {
    if (inputEl.files[0]) onFile(inputEl.files[0]);
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    zoneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      if (!zoneEl.classList.contains('is-disabled')) zoneEl.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    zoneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      zoneEl.classList.remove('dragover');
    });
  });

  zoneEl.addEventListener('drop', (e) => {
    if (zoneEl.classList.contains('is-disabled')) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });
}

wireDropzone(dropzone, fileInput, handleIncomingFile);
wireDropzone(dropzoneA, fileInputA, (file) => setCompareFile('A', file));
wireDropzone(dropzoneB, fileInputB, (file) => setCompareFile('B', file));

/**
 * Répartit le fichier vers le bon module de traitement (convert.js/compress.js/audio.js/
 * video.js/...) selon catégorie et mode. Centralise ce routage ici plutôt que dans
 * runConvertOrCompress pour garder cette dernière focalisée sur le flux UI (statut,
 * historique, téléchargement) indépendamment du type de fichier traité.
 */
async function runConversion(file, category, format, level) {
  if (isCompressing()) {
    if (category === 'image') return compressImage(file, level);
    if (category === 'audio') {
      showProgress(t('status.loadingAudioEngine'));
      return compressAudio(file, level, (percent) => updateProgress(percent));
    }
    if (category === 'video') {
      showProgress(t('status.loadingVideoEngine'));
      return compressVideo(file, level, (percent) => updateProgress(percent));
    }
    if (category === 'document') return compressPdf(file, level);
    throw new Error(t('error.categoryNotSupportedCompress'));
  }

  if (category === 'image') return convertFile(file, format);
  if (category === 'data') return convertData(file, format);
  if (category === 'subtitle') return convertSubtitle(file, format);
  if (category === 'audio') {
    showProgress(t('status.loadingAudioEngine'));
    return convertAudio(file, format, (percent) => updateProgress(percent));
  }
  if (category === 'video') {
    showProgress(t('status.loadingVideoEngine'));
    return convertVideo(file, format, (percent) => updateProgress(percent));
  }
  throw new Error(t('error.categoryNotSupported'));
}

/**
 * Flux complet Convertisseur/Compresseur : lance runConversion, met à jour l'aperçu après
 * (images uniquement), déclenche le téléchargement automatique du résultat, affiche la carte
 * de résultat et journalise l'opération dans l'historique local.
 */
async function runConvertOrCompress() {
  const category = currentCategory();
  const compressing = isCompressing();
  const format = compressing ? extensionOf(selectedFile) : formatSelect.value;
  const level = compressionLevelSelect.value;
  const originalSize = selectedFile.size;

  hideResult();
  setStatus(t(compressing ? 'status.compressing' : 'status.converting'));

  const blob = await runConversion(selectedFile, category, format, level);

  if (category === 'image') {
    if (previewAfterUrl) URL.revokeObjectURL(previewAfterUrl);
    previewAfterUrl = URL.createObjectURL(blob);
    previewAfter.src = previewAfterUrl;
  }

  const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
  const outName = compressing ? `${baseName}-compresse.${format}` : `${baseName}.${format}`;

  downloadBlob(blob, outName);

  setStatus('');
  showResult(blob, outName, compressing ? originalSize : null);

  addHistoryEntry({
    name: outName,
    blob,
    mode: compressing ? 'compress' : 'convert',
    category,
    originalSize: compressing ? originalSize : null,
  })
    .then(renderHistory)
    .catch(() => {});
}

/** Flux complet Inspecteur : détecte la catégorie du fichier puis affiche ses métadonnées. */
async function runInspect() {
  setStatus(t('status.analyzing'));
  const category = inspectCategoryOfExt(extensionOf(selectedInspectFile));
  const items = await inspectFile(selectedInspectFile, category);
  setStatus('');
  renderInspectResult(items);
}

/**
 * Flux complet Comparateur : revalide que les deux fichiers sont de la même catégorie
 * (défense en profondeur — updateCompareCategoryStatus le signale déjà côté UI, mais
 * n'empêche pas techniquement de cliquer Comparer) avant de lancer la comparaison.
 */
async function runCompare() {
  const category = categoryOfExt(extensionOf(selectedCompareFileA));
  const categoryB = categoryOfExt(extensionOf(selectedCompareFileB));
  if (!category || category !== categoryB) {
    throw new Error(t('error.compareDifferentTypes'));
  }
  setStatus(t('status.comparing'));
  const result = await compareFiles(selectedCompareFileA, selectedCompareFileB, category);
  setStatus('');
  renderCompareResult(result);
}

// Point d'entrée unique du bouton principal, quel que soit le mode actif — dispatch vers le
// bon flux (Inspecter/Comparer/Convertir-Compresser) et gère erreurs et état "busy" pour les
// quatre uniformément, plutôt que quatre écouteurs séparés dupliquant try/finally.
convertBtn.addEventListener('click', async () => {
  if (!hasRequiredInput()) return;

  setBusy(true);
  try {
    if (isInspectMode()) await runInspect();
    else if (isCompareMode()) await runCompare();
    else await runConvertOrCompress();
  } catch (err) {
    const fallback = t(
      isInspectMode()
        ? 'error.inspectFailed'
        : isCompareMode()
          ? 'error.compareFailed'
          : isCompressing()
            ? 'error.compressFailed'
            : 'error.convertFailed'
    );
    setStatus(err.message || fallback, 'error');
  } finally {
    hideProgress();
    setBusy(false);
  }
});

downloadBtn.addEventListener('click', () => {
  if (!resultUrl) return;
  downloadBlob(resultBlob, resultFileName);
});

resetBtn.addEventListener('click', () => {
  fileInput.value = '';
  setFile(null);
});

/** Reflète la langue active sur les boutons FR/EN via aria-pressed (état visuel + a11y). */
function syncLangButtons() {
  const lang = getLanguage();
  langFrBtn.setAttribute('aria-pressed', String(lang === 'fr'));
  langEnBtn.setAttribute('aria-pressed', String(lang === 'en'));
}

langFrBtn.addEventListener('click', () => setLanguage('fr'));
langEnBtn.addEventListener('click', () => setLanguage('en'));

// Les traductions statiques (data-i18n) se réappliquent seules dans setLanguage(). Ce qui
// reste à refaire manuellement au changement de langue : le libellé du bouton principal
// (dépend du mode courant, pas d'un data-i18n statique) et les deux options de format de
// sortie non universelles (SVG vectorisé, GIF animé).
document.addEventListener('anyform:langchange', () => {
  syncLangButtons();
  convertBtnLabel.textContent = t(MODE_LABEL_KEYS[currentModeValue]);
  if (!isCompressing() && !isInspectMode() && !isCompareMode()) refreshOutputOptions();
});

syncLangButtons();

// Au premier chargement, les <select> ont déjà leurs options par défaut (livrées
// statiquement dans le HTML) : on ne les repeuple pas ici pour éviter un bug où le
// picker natif du <select> reste désynchronisé sur mobile avant la première interaction.
syncUiForCategory();

/**
 * Si la popup a été ouverte depuis le sous-menu contextuel Anyform (Convertir/Compresser/
 * Inspecter cette image), précharge le fichier déposé par background.js dans
 * chrome.storage.local, dans le mode correspondant à l'entrée cliquée.
 */
async function loadPendingFileFromContextMenu() {
  const params = new URLSearchParams(location.search);
  if (params.get('pending') !== '1') return;

  const { pendingFile } = await chrome.storage.local.get('pendingFile');
  if (!pendingFile) return;

  await chrome.storage.local.remove('pendingFile');

  const res = await fetch(pendingFile.dataUrl);
  const blob = await res.blob();
  const file = new File([blob], pendingFile.name, { type: pendingFile.type });
  const ext = extensionOf(file);

  const mode = params.get('mode');
  if (mode === 'convert' || mode === 'compress' || mode === 'inspect') onModeChange(mode);
  onCategoryChange('image');

  if (isInspectMode()) {
    setInspectFile(file);
    return;
  }

  // Compresseur : la validation se fait sur COMPRESS_FORMATS, pas sur sourceFormatSelect —
  // rien à synchroniser ici, contrairement au Convertisseur.
  if (!isCompressing() && [...sourceFormatSelect.options].some((opt) => opt.value === ext)) {
    sourceFormatSelect.value = ext;
    updateAcceptedFileType();
    refreshOutputOptions();
  }

  setFile(file);
}

// Au premier chargement, les <select> ont déjà leurs options par défaut (livrées
// statiquement dans le HTML) : on ne les repeuple pas ici pour éviter un bug où le
// picker natif du <select> reste désynchronisé sur mobile avant la première interaction.
syncUiForCategory();
loadPendingFileFromContextMenu();
