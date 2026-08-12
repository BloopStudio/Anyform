const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const formatSelect = document.getElementById('format');
const convertBtn = document.getElementById('convertBtn');
const statusEl = document.getElementById('status');

let selectedFile = null;

function setFile(file) {
  selectedFile = file;
  fileNameEl.textContent = file ? file.name : '';
  convertBtn.disabled = !file;
  setStatus('');
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
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('format', format);

  convertBtn.disabled = true;
  setStatus('Conversion en cours…');

  try {
    const res = await fetch('/api/convert', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur ${res.status}`);
    }

    const blob = await res.blob();
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
