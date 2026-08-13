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

const OUTPUT_FORMAT_OPTIONS = {
  image: [
    { value: 'png', label: 'PNG' },
    { value: 'jpg', label: 'JPG' },
    { value: 'webp', label: 'WebP' },
    { value: 'avif', label: 'AVIF' },
    { value: 'ico', label: 'ICO' },
    { value: 'tiff', label: 'TIFF' },
    { value: 'svg', label: 'SVG (vectorisation)' },
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
    { value: 'gif', label: 'GIF (animé)' },
  ],
  subtitle: [
    { value: 'srt', label: 'SRT' },
    { value: 'vtt', label: 'VTT' },
    { value: 'ass', label: 'ASS' },
  ],
};

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
const scaleRow = document.getElementById('scaleRow');
const scaleSelect = document.getElementById('scale');
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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  const units = ['Ko', 'Mo', 'Go'];
  let value = bytes / 1024;
  let unitIndex = 0;
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
        ? `${formatBytes(originalSize)} → ${formatBytes(blob.size)} (-${percent}%)`
        : `${formatBytes(originalSize)} → ${formatBytes(blob.size)} (déjà optimisé, pas de gain)`;
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
    btn.textContent = 'Télécharger';
    btn.addEventListener('click', () => downloadBlob(entry.blob, entry.name));

    li.append(info, btn);
    historyList.appendChild(li);
  }
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
  return Boolean(selectedFile);
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
  scaleSelect.disabled = busy;
  compressionLevelSelect.disabled = busy;
  dropzone.classList.toggle('is-disabled', busy);
  dropzoneA.classList.toggle('is-disabled', busy);
  dropzoneB.classList.toggle('is-disabled', busy);
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
  const options = OUTPUT_FORMAT_OPTIONS[category].filter((opt) => opt.value !== sourceExt);
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

const MODE_LABELS = { convert: 'Convertir', compress: 'Compresser', inspect: 'Inspecter', compare: 'Comparer' };

function onModeChange(mode) {
  currentModeValue = mode;
  setActiveTab(modeTabs, 'mode', mode);
  convertBtnLabel.textContent = MODE_LABELS[mode];

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
  const category = currentCategory();
  updateAcceptedFileType();
  scaleRow.hidden = isCompressing() || isInspectMode() || category !== 'image';
  if (isInspectMode()) {
    setInspectFile(null);
  } else {
    setFile(null);
  }
}

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
        `Format .${ext || '?'} non pris en charge par le compresseur. Formats acceptés : ` +
          `${allowed.map((f) => f.toUpperCase()).join(', ')}.`,
        'error'
      );
      return;
    }
  } else {
    const expectedExt = sourceFormatSelect.value;
    if (ext !== expectedExt) {
      previewRow.hidden = true;
      convertBtn.disabled = true;
      setStatus(
        `Ce fichier est un .${ext || '?'}, mais le format d'entrée sélectionné est .${expectedExt}. ` +
          `Choisis le bon format d'entrée ou dépose un fichier .${expectedExt}.`,
        'error'
      );
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
  if (!categoryOfExt(ext)) {
    selectedInspectFile = null;
    updateConvertBtnEnabled();
    setStatus(`Format .${ext || '?'} non reconnu par Anyform.`, 'error');
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
    setStatus('Un des deux fichiers a un format non reconnu par Anyform.', 'error');
    return;
  }
  if (categoryA !== categoryB) {
    setStatus('Les deux fichiers doivent être du même type pour être comparés.', 'error');
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
      ? 'Images identiques.'
      : `${result.percentIdentical}% des pixels identiques (zone commune).`;
    compareResult.appendChild(summary);

    if (result.sizeMismatch) {
      const note = document.createElement('p');
      note.className = 'compare-note';
      note.textContent = `Dimensions différentes : A = ${result.dimensionsA}, B = ${result.dimensionsB} — comparaison faite sur leur zone commune.`;
      compareResult.appendChild(note);
    }

    if (compareDiffUrl) URL.revokeObjectURL(compareDiffUrl);
    compareDiffUrl = URL.createObjectURL(result.diffBlob);
    const img = document.createElement('img');
    img.className = 'compare-diff-image';
    img.src = compareDiffUrl;
    img.alt = 'Différences en rouge sur fond gris';
    compareResult.appendChild(img);

    const downloadDiffBtn = document.createElement('button');
    downloadDiffBtn.type = 'button';
    downloadDiffBtn.className = 'btn-secondary';
    downloadDiffBtn.textContent = 'Télécharger la diff';
    downloadDiffBtn.addEventListener('click', () => downloadBlob(result.diffBlob, 'diff.png'));
    compareResult.appendChild(downloadDiffBtn);
    return;
  }

  if (result.type === 'text') {
    summary.textContent = result.identical
      ? 'Fichiers identiques.'
      : `${result.added} ligne(s) ajoutée(s), ${result.removed} ligne(s) supprimée(s).`;
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
  summary.textContent = result.identical ? 'Fichiers identiques (même empreinte).' : 'Fichiers différents.';
  compareResult.appendChild(summary);

  if (result.tooLarge) {
    const note = document.createElement('p');
    note.className = 'compare-note';
    note.textContent = 'Fichier trop volumineux pour une diff ligne à ligne détaillée — comparaison par empreinte seulement.';
    compareResult.appendChild(note);
  }

  const details = document.createElement('p');
  details.className = 'compare-note';
  details.textContent = `A : ${formatBytes(result.sizeA)} — SHA-256 ${result.hashA.slice(0, 16)}…`;
  compareResult.appendChild(details);
  const detailsB = document.createElement('p');
  detailsB.className = 'compare-note';
  detailsB.textContent = `B : ${formatBytes(result.sizeB)} — SHA-256 ${result.hashB.slice(0, 16)}…`;
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

async function runConversion(file, category, format, scale, level) {
  if (isCompressing()) {
    if (category === 'image') return compressImage(file, level);
    if (category === 'audio') {
      showProgress('Chargement du moteur audio (une seule fois par session)…');
      return compressAudio(file, level, (percent) => updateProgress(percent));
    }
    if (category === 'video') {
      showProgress('Chargement du moteur vidéo (une seule fois par session)…');
      return compressVideo(file, level, (percent) => updateProgress(percent));
    }
    throw new Error('Type de fichier non supporté par le compresseur.');
  }

  if (category === 'image') return convertFile(file, format, { scale });
  if (category === 'data') return convertData(file, format);
  if (category === 'subtitle') return convertSubtitle(file, format);
  if (category === 'audio') {
    showProgress('Chargement du moteur audio (une seule fois par session)…');
    return convertAudio(file, format, (percent) => updateProgress(percent));
  }
  if (category === 'video') {
    showProgress('Chargement du moteur vidéo (une seule fois par session)…');
    return convertVideo(file, format, (percent) => updateProgress(percent));
  }
  throw new Error('Type de fichier non supporté.');
}

async function runConvertOrCompress() {
  const category = currentCategory();
  const compressing = isCompressing();
  const format = compressing ? extensionOf(selectedFile) : formatSelect.value;
  const scale = parseInt(scaleSelect.value, 10);
  const level = compressionLevelSelect.value;
  const originalSize = selectedFile.size;

  hideResult();
  setStatus(compressing ? 'Compression en cours…' : 'Conversion en cours…');

  const blob = await runConversion(selectedFile, category, format, scale, level);

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

async function runInspect() {
  setStatus('Analyse en cours…');
  const category = categoryOfExt(extensionOf(selectedInspectFile));
  const items = await inspectFile(selectedInspectFile, category);
  setStatus('');
  renderInspectResult(items);
}

async function runCompare() {
  const category = categoryOfExt(extensionOf(selectedCompareFileA));
  const categoryB = categoryOfExt(extensionOf(selectedCompareFileB));
  if (!category || category !== categoryB) {
    throw new Error('Les deux fichiers doivent être du même type reconnu par Anyform pour être comparés.');
  }
  setStatus('Comparaison en cours…');
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
    else await runConvertOrCompress();
  } catch (err) {
    const fallback = isInspectMode()
      ? "Échec de l'inspection."
      : isCompareMode()
        ? 'Échec de la comparaison.'
        : isCompressing()
          ? 'Échec de la compression.'
          : 'Échec de la conversion.';
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

// Au premier chargement, les <select> ont déjà leurs options par défaut (livrées
// statiquement dans le HTML) : on ne les repeuple pas ici pour éviter un bug où le
// picker natif du <select> reste désynchronisé sur mobile avant la première interaction.
syncUiForCategory();

/**
 * Si la popup a été ouverte depuis le menu contextuel ("Convertir cette image"), précharge
 * le fichier déposé par background.js dans chrome.storage.local.
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

  onCategoryChange('image');

  if ([...sourceFormatSelect.options].some((opt) => opt.value === ext)) {
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
