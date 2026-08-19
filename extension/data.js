/**
 * Conversion de données tabulaires (CSV / JSON / XLSX), 100% côté navigateur via SheetJS.
 */

/**
 * Extrait l'extension d'un fichier (en minuscules, sans le point), ou '' si absente.
 * Utilisée dans tout le projet pour deviner le format d'un fichier à partir de son nom.
 */
function extensionOf(file) {
  const m = /\.([a-z0-9]+)$/i.exec(file.name || '');
  return m ? m[1].toLowerCase() : '';
}

/**
 * Charge un fichier de données (CSV/JSON/XLSX/XLS) dans un classeur SheetJS unifié, quel
 * que soit son format d'origine, pour que le reste du code n'ait qu'une seule
 * représentation à manipuler.
 */
async function fileToWorkbook(file) {
  const ext = extensionOf(file);

  if (ext === 'csv') {
    const text = await file.text();
    return XLSX.read(text, { type: 'string' });
  }

  if (ext === 'json') {
    const text = await file.text();
    let data = JSON.parse(text);
    if (!Array.isArray(data)) data = [data];
    const sheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    return workbook;
  }

  // xlsx / xls
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array' });
}

/**
 * Convertit un fichier de données vers csv/json/xlsx et retourne un Blob.
 * @param {File} file
 * @param {'csv'|'json'|'xlsx'} targetFormat
 */
async function convertData(file, targetFormat) {
  const workbook = await fileToWorkbook(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (targetFormat === 'csv') {
    return new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv' });
  }

  if (targetFormat === 'json') {
    const json = XLSX.utils.sheet_to_json(sheet);
    return new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  }

  if (targetFormat === 'xlsx') {
    const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  throw new Error(t('error.dataFormatUnsupported', { format: targetFormat }));
}
