const XLSX = require('xlsx');
const { t } = require('./i18n');

const SUPPORTED_DATA_FORMATS = ['csv', 'json', 'xlsx'];

/**
 * Charge un buffer de données tabulaires dans un classeur SheetJS, quel que soit son
 * format d'origine — sert de base commune à convertData (lib/data.js) et inspectData
 * (lib/inspect.js), qui ont toutes deux besoin d'un accès au classeur avant de le
 * transformer ou de l'inspecter.
 * @param {Buffer} buffer
 * @param {string} sourceExt - 'csv' | 'json' | 'xlsx' | 'xls'
 * @returns {import('xlsx').WorkBook}
 */
function bufferToWorkbook(buffer, sourceExt) {
  if (sourceExt === 'csv') {
    return XLSX.read(buffer.toString('utf8'), { type: 'string' });
  }

  if (sourceExt === 'json') {
    let data = JSON.parse(buffer.toString('utf8'));
    if (!Array.isArray(data)) data = [data];
    const sheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    return workbook;
  }

  // xlsx / xls
  return XLSX.read(buffer, { type: 'buffer' });
}

/**
 * Convertit un buffer de données tabulaires (CSV/JSON/XLSX) vers un autre format.
 * @param {Buffer} inputBuffer
 * @param {string} sourceExt - extension du fichier source ('csv'|'json'|'xlsx'|'xls')
 * @param {string} targetFormat - 'csv'|'json'|'xlsx'
 * @returns {Buffer}
 */
function convertData(inputBuffer, sourceExt, targetFormat) {
  if (!SUPPORTED_DATA_FORMATS.includes(targetFormat)) {
    throw new Error(t('cli.errDataFormatUnsupported', { format: targetFormat }));
  }

  const workbook = bufferToWorkbook(inputBuffer, sourceExt);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (targetFormat === 'csv') {
    return Buffer.from(XLSX.utils.sheet_to_csv(sheet), 'utf8');
  }

  if (targetFormat === 'json') {
    return Buffer.from(JSON.stringify(XLSX.utils.sheet_to_json(sheet), null, 2), 'utf8');
  }

  // xlsx
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

module.exports = { convertData, bufferToWorkbook, SUPPORTED_DATA_FORMATS };
