const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const formatSelect = document.getElementById('format');
const scaleSelect = document.getElementById('scale');
const convertBtn = document.getElementById('convertBtn');
const statusEl = document.getElementById('status');
const previewRow = document.getElementById('previewRow');
const previewBefore = document.getElementById('previewBefore');
const previewAfter = document.getElementById('previewAfter');

let selectedFile = null;
let previewBeforeUrl = null;
let previewAfterUrl = null;

function setFile(file) {
  selectedFile = file;
  fileNameEl.textContent = file ? file.name : '';
  convertBtn.disabled = !file;
  setStatus('');

  if (previewBeforeUrl) URL.revokeObjectURL(previewBeforeUrl);
  if (previewAfterUrl) URL.revokeObjectURL(previewAfterUrl);
  previewAfterUrl = null;
  previewAfter.removeAttribute('src');

  if (file) {
    previewBeforeUrl = URL.createObjectURL(file);
    previewBefore.src = previewBeforeUrl;
    previewRow.hidden = false;
  } else {
    previewRow.hidden = true;
  }
}

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
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

convertBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const format = formatSelect.value;
  const scale = parseInt(scaleSelect.value, 10);

  convertBtn.disabled = true;
  setStatus('Conversion en cours…');

  try {
    const blob = await convertFile(selectedFile, format, { scale });

    if (previewAfterUrl) URL.revokeObjectURL(previewAfterUrl);
    previewAfterUrl = URL.createObjectURL(blob);
    previewAfter.src = previewAfterUrl;

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
