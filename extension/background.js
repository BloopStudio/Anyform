const MENU_ID = 'converter-convert-image';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Convertir cette image avec Converter',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;

  try {
    const res = await fetch(info.srcUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const dataUrl = `data:${blob.type || 'image/png'};base64,${arrayBufferToBase64(buffer)}`;
    const name = guessFileName(info.srcUrl, blob.type);

    await chrome.storage.local.set({ pendingFile: { dataUrl, name, type: blob.type } });
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?pending=1') });
  } catch (err) {
    console.error('Converter: impossible de récupérer cette image.', err);
  }
});

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function guessFileName(url, mimeType) {
  try {
    const { pathname } = new URL(url);
    const base = pathname.split('/').pop() || 'image';
    if (/\.[a-z0-9]+$/i.test(base)) return base;
    const ext = (mimeType || '').split('/')[1] || 'png';
    return `${base}.${ext}`;
  } catch {
    return 'image.png';
  }
}
