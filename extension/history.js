/**
 * Historique local des 5 derniers fichiers convertis/compressés, stockés dans IndexedDB
 * (les fichiers restent sur l'appareil, jamais envoyés nulle part — cohérent avec le reste
 * d'Anyform). Permet de re-télécharger un résultat récent sans refaire l'opération.
 */

const HISTORY_DB_NAME = 'anyform-history';
const HISTORY_STORE = 'entries';
const HISTORY_LIMIT = 5;

let historyDbPromise = null;

function openHistoryDb() {
  if (historyDbPromise) return historyDbPromise;

  historyDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(HISTORY_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return historyDbPromise;
}

/**
 * Ajoute une entrée à l'historique et ne garde que les HISTORY_LIMIT plus récentes.
 * @param {{ name: string, blob: Blob, mode: 'convert'|'compress', category: string, originalSize?: number }} entry
 */
async function addHistoryEntry(entry) {
  const db = await openHistoryDb();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).add({
      name: entry.name,
      blob: entry.blob,
      size: entry.blob.size,
      originalSize: entry.originalSize || null,
      mode: entry.mode,
      category: entry.category,
      timestamp: Date.now(),
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  await pruneHistory(db);
  return getHistoryEntries();
}

async function pruneHistory(db) {
  const all = await new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const request = tx.objectStore(HISTORY_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (all.length <= HISTORY_LIMIT) return;

  const toDelete = all.sort((a, b) => a.timestamp - b.timestamp).slice(0, all.length - HISTORY_LIMIT);

  await new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    for (const item of toDelete) store.delete(item.id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * @returns {Promise<Array>} les entrées les plus récentes en premier.
 */
async function getHistoryEntries() {
  const db = await openHistoryDb();

  const all = await new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const request = tx.objectStore(HISTORY_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return all.sort((a, b) => b.timestamp - a.timestamp);
}

async function clearHistory() {
  const db = await openHistoryDb();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
