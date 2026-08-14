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
  data: [
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
    { value: 'xlsx', label: 'XLSX' },
  ],
  audio: [
    { value: 'wav', label: 'WAV' },
    { value: 'mp3', label: 'MP3' },
    { value: 'ogg', label: 'OGG' },
    { value: 'm4a', label: 'M4A' },
    { value: 'flac', label: 'FLAC' },
    { value: 'aac', label: 'AAC' },
    { value: 'wma', label: 'WMA' },
    { value: 'opus', label: 'Opus' },
  ],
  video: [
    { value: 'mp4', label: 'MP4' },
    { value: 'webm', label: 'WebM' },
    { value: 'mov', label: 'MOV' },
    { value: 'mkv', label: 'MKV' },
    { value: 'avi', label: 'AVI' },
    { value: 'flv', label: 'FLV' },
    { value: 'ogv', label: 'OGV' },
  ],
  subtitle: [
    { value: 'srt', label: 'SRT' },
    { value: 'vtt', label: 'VTT' },
    { value: 'ass', label: 'ASS' },
  ],
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
    data: [
      { value: 'csv', label: 'CSV' },
      { value: 'json', label: 'JSON' },
      { value: 'xlsx', label: 'XLSX' },
    ],
    audio: [
      { value: 'wav', label: 'WAV' },
      { value: 'mp3', label: 'MP3' },
      { value: 'ogg', label: 'OGG' },
      { value: 'm4a', label: 'M4A' },
      { value: 'flac', label: 'FLAC' },
      { value: 'aac', label: 'AAC' },
      { value: 'wma', label: 'WMA' },
      { value: 'opus', label: 'Opus' },
    ],
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
    subtitle: [
      { value: 'srt', label: 'SRT' },
      { value: 'vtt', label: 'VTT' },
      { value: 'ass', label: 'ASS' },
    ],
  };
}

const COMPRESS_FORMATS = {
  image: ['png', 'jpg', 'webp', 'heic'],
  audio: ['wav', 'mp3', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'opus'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv', 'ogv'],
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
const batchResultsSection = document.getElementById('batchResultsSection');
const batchCount = document.getElementById('batchCount');
const batchResultsList = document.getElementById('batchResultsList');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const langFrBtn = document.getElementById('langFr');
const langEnBtn = document.getElementById('langEn');

let selectedFile = null;
// Fichiers du traitement par lot (Convertisseur/Compresseur, 2+ fichiers à la fois) —
// vide en dehors de ce cas précis. selectedFile (ci-dessus) reste le chemin normal pour
// un seul fichier, inchangé, afin de ne rien risquer sur ce qui est déjà testé.
let selectedFiles = [];
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

function currentCategory() {
  return currentCategoryValue;
}

function isCompressing() {
  return currentModeValue === 'compress';
}

function isInspectMode() {
  return currentModeValue === 'inspect';
}

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

// L'Inspecteur reconnaît quelques formats image de plus que le Convertisseur : TIFF/ICO/AVIF
// sont des formats de sortie chez nous (Canvas ne sait pas forcément les recharger en entrée
// pour une conversion), mais les inspecter n'a pas besoin de les reconvertir — juste de lire
// leurs métadonnées (TIFF via UTIF.js sans décodage complet, ICO via parsing d'en-tête, AVIF
// via <img> qui le décode nativement dans les navigateurs récents). Volontairement pas ajouté
// à categoryOfExt : le Comparateur, qui s'appuie dessus aussi, ne gère pas encore ces formats.
const INSPECT_ONLY_IMAGE_EXTS = ['tiff', 'tif', 'ico', 'avif'];

function inspectCategoryOfExt(ext) {
  return categoryOfExt(ext) || (INSPECT_ONLY_IMAGE_EXTS.includes(ext) ? 'image' : null);
}

const BYTE_UNITS = { fr: ['o', 'Ko', 'Mo', 'Go'], en: ['B', 'KB', 'MB', 'GB'] };

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

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function showProgress(label) {
  progressWrap.hidden = false;
  progressBar.classList.add('indeterminate');
  progressBar.style.width = '35%';
  progressLabel.textContent = label;
}

function updateProgress(percent) {
  progressBar.classList.remove('indeterminate');
  progressBar.style.width = `${percent}%`;
  progressLabel.textContent = `${percent}%`;
}

function hideProgress() {
  progressWrap.hidden = true;
  progressBar.classList.remove('indeterminate');
  progressBar.style.width = '0%';
}

function hideResult() {
  resultCard.hidden = true;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  resultBlob = null;
}

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

// Les conversions audio/vidéo peuvent prendre du temps : si l'onglet n'est plus visible
// à la fin, on prévient via une notification native plutôt que de compter sur l'utilisateur
// pour revenir vérifier. La permission doit être demandée depuis un geste utilisateur
// (le clic sur "Convertir"), pas au chargement de la page.
function notifyIfHidden(category, compressing) {
  if (category !== 'audio' && category !== 'video') return;
  if (typeof Notification === 'undefined') return;
  if (!document.hidden || Notification.permission !== 'granted') return;

  const label = t(compressing ? 'notify.compressionDone' : 'notify.conversionDone');
  new Notification('Anyform', { body: `${label} : ${resultFileName}` });
}

clearHistoryBtn.addEventListener('click', () => {
  clearHistory().then(() => renderHistory([]));
});

getHistoryEntries().then(renderHistory).catch(() => {});

// Le bouton principal ne se réactive que si l'entrée requise par le mode courant est
// prête : un fichier pour Convertisseur/Compresseur/Inspecteur, deux pour Comparateur.
function hasRequiredInput() {
  if (isInspectMode()) return Boolean(selectedInspectFile);
  if (isCompareMode()) return Boolean(selectedCompareFileA && selectedCompareFileB);
  return Boolean(selectedFile) || selectedFiles.length > 0;
}

function updateConvertBtnEnabled() {
  convertBtn.disabled = !hasRequiredInput();
}

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
  downloadZipBtn.disabled = busy;
}

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

function refreshOutputOptions() {
  const category = currentCategory();
  const sourceExt = sourceFormatSelect.value;
  const options = getOutputFormatOptions()[category].filter((opt) => opt.value !== sourceExt);
  populateSelect(formatSelect, options, { preserveSelection: true });
}

function setActiveTab(tabsEl, datasetKey, value) {
  for (const tab of tabsEl.querySelectorAll('.tab')) {
    const isActive = tab.dataset[datasetKey] === value;
    tab.setAttribute('aria-selected', String(isActive));
    tab.classList.toggle('is-active', isActive);
  }
}

function onCategoryChange(category) {
  currentCategoryValue = category;
  setActiveTab(categoryTabs, 'category', category);
  populateSelect(sourceFormatSelect, INPUT_FORMAT_OPTIONS[category]);
  refreshOutputOptions();
  syncUiForCategory();
}

const MODE_LABEL_KEYS = { convert: 'mode.convert.btn', compress: 'mode.compress.btn', inspect: 'mode.inspect.btn', compare: 'mode.compare.btn' };

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
  hideBatchResults();
  inspectResult.hidden = true;
  compareResult.hidden = true;
  if (inspecting || comparing) previewRow.hidden = true;

  if (compressing && !COMPRESS_FORMATS[currentCategory()]) {
    currentCategoryValue = 'image';
    setActiveTab(categoryTabs, 'category', 'image');
    populateSelect(sourceFormatSelect, INPUT_FORMAT_OPTIONS.image);
    refreshOutputOptions();
  }

  for (const tab of categoryTabs.querySelectorAll('.tab')) {
    tab.hidden = compressing && !COMPRESS_FORMATS[tab.dataset.category];
  }

  if (comparing) {
    resetCompare();
  } else {
    syncUiForCategory();
  }
}

function syncUiForCategory() {
  updateAcceptedFileType();
  if (isInspectMode()) {
    setInspectFile(null);
  } else {
    setFile(null);
  }
}

// Vérifie qu'un fichier correspond au mode/catégorie courants, sinon lève une erreur avec
// un message prêt à afficher. Factorisé pour être réutilisé à la fois par setFile
// (validation immédiate, un seul fichier) et par le traitement par lot (validation
// différée à l'exécution, par fichier — voir runBatchConvertOrCompress).
function assertFileMatchesMode(file, category, compressing) {
  const ext = extensionOf(file);

  if (compressing) {
    const allowed = COMPRESS_FORMATS[category] || [];
    if (!allowed.includes(ext)) {
      throw new Error(
        t('error.formatNotSupportedCompress', { ext: ext || '?', allowed: allowed.map((f) => f.toUpperCase()).join(', ') })
      );
    }
  } else {
    const expectedExt = sourceFormatSelect.value;
    if (ext !== expectedExt) {
      throw new Error(t('error.wrongInputFormat', { ext: ext || '?', expected: expectedExt }));
    }
  }
}

function setFile(file) {
  selectedFile = file;
  selectedFiles = [];
  fileNameEl.textContent = file ? file.name : '';
  hideResult();
  hideBatchResults();
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

  try {
    assertFileMatchesMode(file, category, isCompressing());
  } catch (err) {
    previewRow.hidden = true;
    convertBtn.disabled = true;
    setStatus(err.message, 'error');
    return;
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

// Dispatcher appelé par la dropzone principale en mode Convertisseur/Compresseur : un
// seul fichier suit le chemin existant (setFile, testé, avec validation immédiate et
// aperçu avant/après pour les images) ; plusieurs fichiers passent en traitement par lot,
// dont la validation est différée à l'exécution (voir runBatchConvertOrCompress) —
// afficher N messages d'erreur avant même de cliquer serait plus confus qu'utile.
function setFiles(files) {
  if (files.length <= 1) {
    setFile(files[0] || null);
    return;
  }

  selectedFile = null;
  selectedFiles = files;
  hideResult();
  hideBatchResults();
  hideProgress();
  if (previewBeforeUrl) URL.revokeObjectURL(previewBeforeUrl);
  if (previewAfterUrl) URL.revokeObjectURL(previewAfterUrl);
  previewAfterUrl = null;
  previewRow.hidden = true;

  fileNameEl.textContent = t('batch.filesSelected', { n: files.length, plural: files.length > 1 ? 's' : '' });
  setStatus('');
  updateConvertBtnEnabled();
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

function resetCompare() {
  selectedCompareFileA = null;
  selectedCompareFileB = null;
  fileNameA.textContent = '';
  fileNameB.textContent = '';
  compareResult.hidden = true;
  updateConvertBtnEnabled();
  setStatus('');
}

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

for (const tab of categoryTabs.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => onCategoryChange(tab.dataset.category));
}

for (const tab of modeTabs.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => onModeChange(tab.dataset.mode));
}

sourceFormatSelect.addEventListener('change', () => {
  updateAcceptedFileType();
  refreshOutputOptions();
  // En lot, la validation est différée à l'exécution (voir setFiles) : rien à refaire
  // ici, un setFile(null) effacerait la sélection en cours pour rien.
  if (selectedFiles.length === 0) setFile(selectedFile);
});

// Le mode courant décide qui reçoit le(s) fichier(s) déposé(s) sur la dropzone
// principale : Convertisseur/Compresseur acceptent plusieurs fichiers à la fois
// (traitement par lot, voir setFiles) ; Inspecteur reste volontairement limité à un seul
// fichier à la fois (n'a pas de notion de lot), donc seul le premier est retenu.
function handleIncomingFiles(files) {
  if (!files.length) return;
  if (isInspectMode()) setInspectFile(files[0]);
  else setFiles(files);
}

// Câble une zone de glisser-déposer (clic, clavier, drag & drop, <input type=file>) sur un
// gestionnaire commun — utilisé pour la dropzone principale (peut recevoir plusieurs
// fichiers) et pour les deux du Comparateur (toujours un seul, le second est ignoré par
// leur callback). onFiles reçoit toujours un tableau, jamais un fichier isolé.
function wireDropzone(zoneEl, inputEl, onFiles) {
  zoneEl.addEventListener('click', () => inputEl.click());
  zoneEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputEl.click();
    }
  });

  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) onFiles(Array.from(inputEl.files));
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
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  });
}

wireDropzone(dropzone, fileInput, handleIncomingFiles);
wireDropzone(dropzoneA, fileInputA, (files) => setCompareFile('A', files[0]));
wireDropzone(dropzoneB, fileInputB, (files) => setCompareFile('B', files[0]));

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

async function runConvertOrCompress() {
  const category = currentCategory();
  const compressing = isCompressing();
  const format = compressing ? extensionOf(selectedFile) : formatSelect.value;
  const level = compressionLevelSelect.value;
  const originalSize = selectedFile.size;

  if (
    (category === 'audio' || category === 'video') &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default'
  ) {
    Notification.requestPermission().catch(() => {});
  }

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
  notifyIfHidden(category, compressing);

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

function hideBatchResults() {
  batchResultsSection.hidden = true;
  batchResultsList.innerHTML = '';
  downloadZipBtn.hidden = true;
  downloadZipBtn.onclick = null;
}

/**
 * Affiche la liste des résultats du traitement par lot : un élément par fichier, avec son
 * propre bouton "Télécharger" (l'utilisateur choisit un par un, ou tout d'un coup via le
 * ZIP — jamais un téléchargement automatique groupé, qui déclencherait l'anti-popup du
 * navigateur sur plusieurs fichiers à la fois). Les échecs restent dans la liste (barrés,
 * message d'erreur) plutôt que d'être passés sous silence.
 */
function renderBatchResults(results) {
  batchResultsList.innerHTML = '';
  const successes = results.filter((r) => !r.error);
  batchCount.textContent = t('batch.resultsCount', {
    success: successes.length,
    total: results.length,
    plural: successes.length > 1 ? 's' : '',
  });

  for (const r of results) {
    const li = document.createElement('li');
    li.className = 'batch-result-item' + (r.error ? ' is-error' : '');

    const info = document.createElement('div');
    info.className = 'batch-result-info';
    const name = document.createElement('p');
    name.className = 'batch-result-name';
    name.textContent = r.error ? r.sourceName : r.name;
    const meta = document.createElement('p');
    meta.className = 'batch-result-meta';
    meta.textContent = r.error
      ? r.error
      : r.originalSize
        ? `${formatBytes(r.originalSize)} → ${formatBytes(r.blob.size)}`
        : formatBytes(r.blob.size);
    info.append(name, meta);
    li.appendChild(info);

    if (!r.error) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-ghost btn-small';
      btn.textContent = t('btn.download');
      btn.addEventListener('click', () => downloadBlob(r.blob, r.name));
      li.appendChild(btn);
    }

    batchResultsList.appendChild(li);
  }

  downloadZipBtn.hidden = successes.length === 0;
  downloadZipBtn.onclick = successes.length
    ? async () => {
        downloadZipBtn.disabled = true;
        try {
          const zipBlob = await createZipBlob(successes.map((r) => ({ name: r.name, blob: r.blob })));
          downloadBlob(zipBlob, 'anyform.zip');
        } catch (err) {
          setStatus(err.message || t('error.zipCreation'), 'error');
        } finally {
          downloadZipBtn.disabled = false;
        }
      }
    : null;

  batchResultsSection.hidden = false;
}

/**
 * Traite plusieurs fichiers à la suite (Convertisseur/Compresseur). Contrairement au
 * chemin à un seul fichier, chaque échec est capturé et affiché dans son propre élément
 * de la liste plutôt que d'interrompre le lot — un fichier au mauvais format ne doit pas
 * empêcher les autres d'être traités (même logique que le CLI, fichier par fichier).
 */
async function runBatchConvertOrCompress() {
  const category = currentCategory();
  const compressing = isCompressing();
  const level = compressionLevelSelect.value;
  const files = selectedFiles;

  if (
    (category === 'audio' || category === 'video') &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default'
  ) {
    Notification.requestPermission().catch(() => {});
  }

  hideBatchResults();

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    setStatus(t(compressing ? 'batch.progressCompress' : 'batch.progressConvert', { i: i + 1, n: files.length, name: file.name }));
    const format = compressing ? extensionOf(file) : formatSelect.value;
    const originalSize = file.size;

    try {
      assertFileMatchesMode(file, category, compressing);
      const blob = await runConversion(file, category, format, level);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const outName = compressing ? `${baseName}-compresse.${format}` : `${baseName}.${format}`;
      results.push({ sourceName: file.name, name: outName, blob, originalSize: compressing ? originalSize : null, error: null });
    } catch (err) {
      results.push({ sourceName: file.name, error: err.message || t('error.generic') });
    }
  }

  setStatus('');
  renderBatchResults(results);

  const successes = results.filter((r) => !r.error);
  if (
    successes.length &&
    (category === 'audio' || category === 'video') &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted' &&
    document.hidden
  ) {
    new Notification('Anyform', {
      body: t(compressing ? 'notify.batchCompressionDone' : 'notify.batchConversionDone', {
        success: successes.length,
        total: results.length,
      }),
    });
  }

  for (const r of successes) {
    addHistoryEntry({
      name: r.name,
      blob: r.blob,
      mode: compressing ? 'compress' : 'convert',
      category,
      originalSize: r.originalSize,
    })
      .then(renderHistory)
      .catch(() => {});
  }
}

async function runInspect() {
  setStatus(t('status.analyzing'));
  const category = inspectCategoryOfExt(extensionOf(selectedInspectFile));
  const items = await inspectFile(selectedInspectFile, category);
  setStatus('');
  renderInspectResult(items);
}

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

convertBtn.addEventListener('click', async () => {
  if (!hasRequiredInput()) return;

  setBusy(true);
  try {
    if (isInspectMode()) await runInspect();
    else if (isCompareMode()) await runCompare();
    else if (selectedFiles.length > 1) await runBatchConvertOrCompress();
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
