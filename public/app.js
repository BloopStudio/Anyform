const CATEGORY_EXT = {
  image: ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'],
  data: ['csv', 'json', 'xlsx', 'xls'],
  audio: ['wav', 'mp3', 'ogg', 'm4a', 'flac', 'aac'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi'],
};

const FORMAT_OPTIONS = {
  image: [
    { value: 'png', label: 'PNG' },
    { value: 'jpg', label: 'JPG' },
    { value: 'webp', label: 'WebP' },
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
  ],
  video: [
    { value: 'mp4', label: 'MP4' },
    { value: 'webm', label: 'WebM' },
  ],
};

function detectCategory(file) {
  const ext = extensionOf(file);
  for (const [category, exts] of Object.entries(CATEGORY_EXT)) {
    if (exts.includes(ext)) return category;
  }
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const formatSelect = document.getElementById('format');
const scaleRow = document.getElementById('scaleRow');
const scaleSelect = document.getElementById('scale');
const convertBtn = document.getElementById('convertBtn');
const statusEl = document.getElementById('status');
const previewRow = document.getElementById('previewRow');
const previewBefore = document.getElementById('previewBefore');
const previewAfter = document.getElementById('previewAfter');

let selectedFile = null;
let selectedCategory = null;
let previewBeforeUrl = null;
let previewAfterUrl = null;

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function populateFormats(category) {
  formatSelect.innerHTML = '';
  for (const opt of FORMAT_OPTIONS[category] || []) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    formatSelect.appendChild(el);
  }
}

function setFile(file) {
  selectedFile = file;
  selectedCategory = file ? detectCategory(file) : null;
  fileNameEl.textContent = file ? file.name : '';

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

  if (!selectedCategory) {
    previewRow.hidden = true;
    convertBtn.disabled = true;
    setStatus(`Type de fichier non reconnu : ${file.name}`, 'error');
    return;
  }

  populateFormats(selectedCategory);
  scaleRow.style.display = selectedCategory === 'image' ? 'flex' : 'none';

  if (selectedCategory === 'image') {
    previewBeforeUrl = URL.createObjectURL(file);
    previewBefore.src = previewBeforeUrl;
    previewRow.hidden = false;
  } else {
    previewRow.hidden = true;
  }

  convertBtn.disabled = false;
  setStatus('');
}

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

async function runConversion(file, category, format, scale) {
  if (category === 'image') return convertFile(file, format, { scale });
  if (category === 'data') return convertData(file, format);
  if (category === 'audio') return convertAudio(file, format);
  if (category === 'video') {
    return convertVideo(file, format, (percent) => setStatus(`Conversion en cours… ${percent}%`));
  }
  throw new Error('Type de fichier non supporté.');
}

convertBtn.addEventListener('click', async () => {
  if (!selectedFile || !selectedCategory) return;

  const format = formatSelect.value;
  const scale = parseInt(scaleSelect.value, 10);

  convertBtn.disabled = true;
  setStatus(
    selectedCategory === 'video'
      ? 'Chargement du moteur vidéo (première fois : téléchargement ~30 Mo)…'
      : 'Conversion en cours…'
  );

  try {
    const blob = await runConversion(selectedFile, selectedCategory, format, scale);

    if (selectedCategory === 'image') {
      if (previewAfterUrl) URL.revokeObjectURL(previewAfterUrl);
      previewAfterUrl = URL.createObjectURL(blob);
      previewAfter.src = previewAfterUrl;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
    a.href = url;
    a.download = `${baseName}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setStatus('Conversion réussie, téléchargement lancé.', 'success');
  } catch (err) {
    setStatus(err.message || 'Échec de la conversion.', 'error');
  } finally {
    convertBtn.disabled = false;
  }
});
