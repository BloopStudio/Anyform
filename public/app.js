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
};

const COMPRESS_FORMATS = {
  image: ['png', 'jpg', 'webp', 'gif', 'bmp', 'heic'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv', 'ogv'],
};

const modeTabs = document.getElementById('modeTabs');
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

let selectedFile = null;
let previewBeforeUrl = null;
let previewAfterUrl = null;
let resultBlob = null;
let resultUrl = null;
let resultFileName = '';
let currentModeValue = modeTabs.querySelector('.tab[aria-selected="true"]')?.dataset.mode || 'convert';
let currentCategoryValue = categoryTabs.querySelector('.tab[aria-selected="true"]')?.dataset.category || 'image';

function currentCategory() {
  return currentCategoryValue;
}

function isCompressing() {
  return currentModeValue === 'compress';
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

function setBusy(busy) {
  convertBtn.disabled = busy || !selectedFile;
  convertBtn.classList.toggle('is-loading', busy);
  for (const tab of categoryTabs.querySelectorAll('.tab')) tab.disabled = busy;
  for (const tab of modeTabs.querySelectorAll('.tab')) tab.disabled = busy;
  sourceFormatSelect.disabled = busy;
  formatSelect.disabled = busy;
  scaleSelect.disabled = busy;
  compressionLevelSelect.disabled = busy;
  dropzone.classList.toggle('is-disabled', busy);
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
  if (isCompressing()) {
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

function onModeChange(mode) {
  currentModeValue = mode;
  setActiveTab(modeTabs, 'mode', mode);

  const compressing = isCompressing();
  formatRow.hidden = compressing;
  compressionRow.hidden = !compressing;
  convertBtnLabel.textContent = compressing ? 'Compresser' : 'Convertir';

  for (const tab of categoryTabs.querySelectorAll('.tab')) {
    tab.hidden = compressing && !COMPRESS_FORMATS[tab.dataset.category];
  }

  if (compressing && !COMPRESS_FORMATS[currentCategory()]) {
    currentCategoryValue = 'image';
    setActiveTab(categoryTabs, 'category', 'image');
    populateSelect(sourceFormatSelect, INPUT_FORMAT_OPTIONS.image);
    refreshOutputOptions();
  }

  syncUiForCategory();
}

function syncUiForCategory() {
  const category = currentCategory();
  updateAcceptedFileType();
  scaleRow.hidden = isCompressing() || category !== 'image';
  setFile(null);
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

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    if (!dropzone.classList.contains('is-disabled')) dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  if (dropzone.classList.contains('is-disabled')) return;
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

async function runConversion(file, category, format, scale, level) {
  if (isCompressing()) {
    if (category === 'image') return compressImage(file, level);
    if (category === 'video') {
      showProgress('Chargement du moteur vidéo (une seule fois par session)…');
      return compressVideo(file, level, (percent) => updateProgress(percent));
    }
    throw new Error('Type de fichier non supporté par le compresseur.');
  }

  if (category === 'image') return convertFile(file, format, { scale });
  if (category === 'data') return convertData(file, format);
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

convertBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const category = currentCategory();
  const compressing = isCompressing();
  const format = compressing ? extensionOf(selectedFile) : formatSelect.value;
  const scale = parseInt(scaleSelect.value, 10);
  const level = compressionLevelSelect.value;
  const originalSize = selectedFile.size;

  hideResult();
  setBusy(true);
  setStatus(compressing ? 'Compression en cours…' : 'Conversion en cours…');

  try {
    const blob = await runConversion(selectedFile, category, format, scale, level);

    if (category === 'image') {
      if (previewAfterUrl) URL.revokeObjectURL(previewAfterUrl);
      previewAfterUrl = URL.createObjectURL(blob);
      previewAfter.src = previewAfterUrl;
    }

    const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
    const outName = compressing ? `${baseName}-compresse.${format}` : `${baseName}.${format}`;

    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setStatus('');
    showResult(blob, outName, compressing ? originalSize : null);
  } catch (err) {
    setStatus(err.message || (compressing ? 'Échec de la compression.' : 'Échec de la conversion.'), 'error');
  } finally {
    hideProgress();
    setBusy(false);
  }
});

downloadBtn.addEventListener('click', () => {
  if (!resultUrl) return;
  const a = document.createElement('a');
  a.href = resultUrl;
  a.download = resultFileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

resetBtn.addEventListener('click', () => {
  fileInput.value = '';
  setFile(null);
});

// Au premier chargement, les <select> ont déjà leurs options par défaut (livrées
// statiquement dans le HTML) : on ne les repeuple pas ici pour éviter un bug où le
// picker natif du <select> reste désynchronisé sur mobile avant la première interaction.
syncUiForCategory();
