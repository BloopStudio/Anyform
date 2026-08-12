const INPUT_FORMAT_OPTIONS = {
  image: [
    { value: 'svg', label: 'SVG' },
    { value: 'png', label: 'PNG' },
    { value: 'jpg', label: 'JPG' },
    { value: 'webp', label: 'WebP' },
    { value: 'gif', label: 'GIF' },
    { value: 'bmp', label: 'BMP' },
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
  ],
  video: [
    { value: 'mp4', label: 'MP4' },
    { value: 'webm', label: 'WebM' },
    { value: 'mov', label: 'MOV' },
    { value: 'mkv', label: 'MKV' },
  ],
};

const OUTPUT_FORMAT_OPTIONS = {
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

const categorySelect = document.getElementById('category');
const sourceFormatSelect = document.getElementById('sourceFormat');
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
let previewBeforeUrl = null;
let previewAfterUrl = null;

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function populateSelect(selectEl, options) {
  selectEl.innerHTML = '';
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    selectEl.appendChild(el);
  }
}

function currentCategory() {
  return categorySelect.value;
}

function refreshFormatOptions() {
  const category = currentCategory();
  populateSelect(sourceFormatSelect, INPUT_FORMAT_OPTIONS[category]);
  populateSelect(formatSelect, OUTPUT_FORMAT_OPTIONS[category]);
  fileInput.accept = INPUT_FORMAT_OPTIONS[category].map((opt) => `.${opt.value}`).join(',');
  scaleRow.style.display = category === 'image' ? 'flex' : 'none';
  setFile(null);
}

function setFile(file) {
  selectedFile = file;
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

  const category = currentCategory();
  const ext = extensionOf(file);
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

categorySelect.addEventListener('change', refreshFormatOptions);
sourceFormatSelect.addEventListener('change', () => setFile(selectedFile));

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
  if (!selectedFile) return;

  const category = currentCategory();
  const format = formatSelect.value;
  const scale = parseInt(scaleSelect.value, 10);

  convertBtn.disabled = true;
  setStatus(
    category === 'video'
      ? 'Chargement du moteur vidéo (première fois : téléchargement ~30 Mo)…'
      : 'Conversion en cours…'
  );

  try {
    const blob = await runConversion(selectedFile, category, format, scale);

    if (category === 'image') {
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

refreshFormatOptions();
