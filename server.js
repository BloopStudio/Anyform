const path = require('path');
const express = require('express');
const multer = require('multer');
const { convertImage, normalizeFormat, SUPPORTED_OUTPUT_FORMATS } = require('./lib/convert');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/formats', (req, res) => {
  res.json({ formats: SUPPORTED_OUTPUT_FORMATS });
});

app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier fourni.' });
  }

  const target = normalizeFormat(req.body.format);
  if (!SUPPORTED_OUTPUT_FORMATS.includes(target)) {
    return res.status(400).json({ error: `Format de sortie non supporté: ${req.body.format}` });
  }

  try {
    const result = await convertImage(req.file.buffer, target);
    const baseName = path.parse(req.file.originalname).name;
    const isSvg = target === 'svg';

    res.setHeader('Content-Type', isSvg ? 'image/svg+xml' : `image/${target}`);
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.${target}"`);
    res.send(isSvg ? result : result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Échec de la conversion.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Convertisseur web démarré sur http://localhost:${PORT}`);
});
