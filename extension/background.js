/**
 * Service worker MV3 de l'extension (déclaré dans manifest.json sous "background") : tourne
 * en arrière-plan sans page visible, s'arrête quand inactif et redémarre à la demande. Son
 * seul rôle ici est le menu contextuel "Convertir cette image" — la popup (popup.js) fait
 * tout le reste et n'a besoin d'aucune communication directe avec ce worker en dehors de
 * chrome.storage.local (voir plus bas).
 *
 * Permissions manifest utilisées ici : "contextMenus" (créer l'entrée du clic droit),
 * "storage" (chrome.storage.local, seul canal pour passer le fichier à la popup — un
 * service worker MV3 n'a pas de DOM/window partagé avec la popup) et "downloads" (déclarée
 * mais non utilisée directement par ce fichier ; le téléchargement du résultat passe par un
 * <a download> dans popup.js). host_permissions: ["<all_urls>"] est nécessaire pour pouvoir
 * fetch() l'image source depuis n'importe quel site visité, quel que soit son domaine.
 *
 * Ce fichier n'a pas besoin de la CSP "script-src 'self' 'wasm-unsafe-eval'" déclarée dans
 * manifest.json (content_security_policy.extension_pages) : cette directive assouplie existe
 * pour permettre à ffmpeg-engine.js, chargé depuis popup.html, d'exécuter le WebAssembly de
 * ffmpeg.wasm ('wasm-unsafe-eval'), tout en gardant 'self' comme seule origine de script
 * autorisée (aucun script distant, cohérent avec la promesse "100% local" de l'extension).
 */
const MENU_ID = 'converter-convert-image';

/**
 * Crée l'entrée de menu contextuel au clic droit sur une image, exécuté une fois à
 * l'installation/mise à jour de l'extension (onInstalled) plutôt qu'à chaque démarrage du
 * service worker — chrome.contextMenus.create échouerait avec une erreur "duplicate id" s'il
 * était appelé plus d'une fois par session du menu contextuel.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Convertir cette image avec Anyform',
    contexts: ['image'],
  });
});

/**
 * Récupère l'image cliquée et la transmet à la popup pour préchargement. On ne peut pas
 * ouvrir la popup directement avec un fichier en argument (l'API chrome.action n'a pas de
 * mécanisme pour ça), donc le fichier transite par chrome.storage.local sous forme de data
 * URL base64 : la popup, une fois ouverte via l'URL ?pending=1, le relit et le supprime du
 * storage (voir loadPendingFileFromContextMenu dans popup.js). fetch() fonctionne ici sur
 * n'importe quelle URL grâce à host_permissions: ["<all_urls>"] dans le manifest.
 */
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
    console.error('Anyform: impossible de récupérer cette image.', err);
  }
});

/**
 * Encode un ArrayBuffer en base64 par blocs (chunks de 32 Ko) plutôt qu'en un seul appel à
 * String.fromCharCode.apply : passer un buffer entier d'un coup peut dépasser la limite
 * d'arguments d'un appel de fonction du moteur JS pour de grosses images.
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Déduit un nom de fichier depuis l'URL de l'image cliquée. Beaucoup d'URL d'images
 * n'ont pas d'extension exploitable (images servies par un CDN avec des chemins opaques,
 * paramètres de requête, etc.) : dans ce cas on retombe sur le type MIME réel du blob
 * récupéré, plus fiable que l'URL puisqu'il vient directement de la réponse HTTP.
 */
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
