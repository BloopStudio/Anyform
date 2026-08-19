/**
 * Comparateur : seul mode à deux entrées (fichier A / fichier B) au lieu d'un seul.
 * Trois stratégies selon le type de fichier :
 *  - Image  : diff pixel par pixel, rendue dans un canvas (zones qui changent en rouge).
 *  - Texte  : diff ligne à ligne façon "git diff" (algorithme LCS classique).
 *  - Autre (audio/vidéo/xlsx/fichiers texte trop volumineux) : comparaison par empreinte
 *    SHA-256 seulement — identique ou différent, sans détail visuel.
 */

const TEXT_DIFF_CATEGORIES = ['data', 'subtitle'];
// Au-delà de cette taille, la diff ligne à ligne (LCS, coût O(n×m) en temps ET en mémoire)
// deviendrait trop lente/gourmande dans un onglet de navigateur — on retombe sur la
// comparaison par empreinte plutôt que de figer la page.
const MAX_DIFF_LINES = 3000;

/**
 * Diff ligne à ligne par plus longue sous-séquence commune (LCS), méthode standard
 * derrière `diff`/`git diff`. dp[i][j] = longueur de la LCS entre linesA[i:] et
 * linesB[j:] ; on la calcule à l'envers puis on "remonte" (backtrack) pour reconstruire
 * la séquence égal/ajouté/supprimé.
 */
function diffLines(linesA, linesB) {
  const n = linesA.length;
  const m = linesB.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = linesA[i] === linesB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (linesA[i] === linesB[j]) {
      result.push({ type: 'equal', text: linesA[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'removed', text: linesA[i] });
      i++;
    } else {
      result.push({ type: 'added', text: linesB[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: 'removed', text: linesA[i] });
    i++;
  }
  while (j < m) {
    result.push({ type: 'added', text: linesB[j] });
    j++;
  }

  return result;
}

/**
 * Calcule l'empreinte SHA-256 d'un fichier (via l'API Web Crypto native) et la retourne en
 * hexadécimal.
 */
async function sha256Hex(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compare deux fichiers uniquement par empreinte SHA-256 (identique/différent, sans
 * détail) : la stratégie de repli pour tout ce qui n'a pas de comparaison visuelle/texte
 * dédiée.
 */
async function compareByHash(fileA, fileB) {
  const [hashA, hashB] = await Promise.all([sha256Hex(fileA), sha256Hex(fileB)]);
  return {
    type: 'hash',
    identical: hashA === hashB,
    hashA,
    hashB,
    sizeA: fileA.size,
    sizeB: fileB.size,
  };
}

/**
 * Compare deux fichiers texte ligne à ligne via diffLines, avec repli sur une comparaison
 * par empreinte si l'un des deux dépasse MAX_DIFF_LINES.
 */
async function compareText(fileA, fileB) {
  const [textA, textB] = await Promise.all([fileA.text(), fileB.text()]);
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');

  if (linesA.length > MAX_DIFF_LINES || linesB.length > MAX_DIFF_LINES) {
    const result = await compareByHash(fileA, fileB);
    result.tooLarge = true;
    return result;
  }

  const diff = diffLines(linesA, linesB);
  const added = diff.filter((d) => d.type === 'added').length;
  const removed = diff.filter((d) => d.type === 'removed').length;

  return {
    type: 'text',
    identical: added === 0 && removed === 0,
    diff,
    added,
    removed,
  };
}

/**
 * Compare deux images pixel par pixel sur leur zone commune (le plus petit des deux
 * rectangles si les dimensions diffèrent) et produit une image de diff : pixels
 * identiques en niveaux de gris atténués, pixels qui changent significativement en rouge.
 */
async function compareImages(fileA, fileB) {
  const [dataUrlA, dataUrlB] = await Promise.all([readFileAsDataUrl(fileA), readFileAsDataUrl(fileB)]);
  const [imgA, imgB] = await Promise.all([loadImage(dataUrlA), loadImage(dataUrlB)]);

  const width = Math.min(imgA.naturalWidth, imgB.naturalWidth);
  const height = Math.min(imgA.naturalHeight, imgB.naturalHeight);
  const sizeMismatch = imgA.naturalWidth !== imgB.naturalWidth || imgA.naturalHeight !== imgB.naturalHeight;

  const canvasA = document.createElement('canvas');
  canvasA.width = width;
  canvasA.height = height;
  canvasA.getContext('2d').drawImage(imgA, 0, 0, width, height);
  const pixelsA = canvasA.getContext('2d').getImageData(0, 0, width, height).data;

  const canvasB = document.createElement('canvas');
  canvasB.width = width;
  canvasB.height = height;
  canvasB.getContext('2d').drawImage(imgB, 0, 0, width, height);
  const pixelsB = canvasB.getContext('2d').getImageData(0, 0, width, height).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d');
  const outData = outCtx.createImageData(width, height);

  // Seuil au-delà duquel un pixel est considéré "différent" (somme des écarts R+G+B) :
  // évite de signaler du bruit de compression JPEG imperceptible comme une vraie diff.
  const THRESHOLD = 30;
  let diffCount = 0;
  const totalPixels = width * height;

  for (let p = 0; p < totalPixels; p++) {
    const o = p * 4;
    const dr = Math.abs(pixelsA[o] - pixelsB[o]);
    const dg = Math.abs(pixelsA[o + 1] - pixelsB[o + 1]);
    const db = Math.abs(pixelsA[o + 2] - pixelsB[o + 2]);
    const different = dr + dg + db > THRESHOLD;

    if (different) {
      diffCount++;
      outData.data[o] = 255;
      outData.data[o + 1] = 0;
      outData.data[o + 2] = 0;
      outData.data[o + 3] = 255;
    } else {
      // Pixel identique : affiché en gris atténué (moyenne des canaux, assombrie) pour
      // que les zones rouges ressortent clairement au premier coup d'œil.
      const gray = Math.round((pixelsA[o] + pixelsA[o + 1] + pixelsA[o + 2]) / 3 / 2);
      outData.data[o] = gray;
      outData.data[o + 1] = gray;
      outData.data[o + 2] = gray;
      outData.data[o + 3] = 255;
    }
  }

  outCtx.putImageData(outData, 0, 0);

  const diffBlob = await new Promise((resolve, reject) => {
    outCanvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(t('error.diffGeneration')))), 'image/png');
  });

  const percentIdentical = totalPixels > 0 ? Math.round(((totalPixels - diffCount) / totalPixels) * 1000) / 10 : 100;

  return {
    type: 'image',
    identical: diffCount === 0 && !sizeMismatch,
    percentIdentical,
    diffBlob,
    sizeMismatch,
    dimensionsA: `${imgA.naturalWidth} × ${imgA.naturalHeight}`,
    dimensionsB: `${imgB.naturalWidth} × ${imgB.naturalHeight}`,
  };
}

/**
 * Compare deux fichiers et retourne un résultat dont la forme dépend de `category` :
 * image (diff visuelle), data/subtitle (diff texte), tout le reste (empreinte SHA-256).
 * @param {File} fileA
 * @param {File} fileB
 * @param {string} category
 */
async function compareFiles(fileA, fileB, category) {
  if (category === 'image') return compareImages(fileA, fileB);
  if (TEXT_DIFF_CATEGORIES.includes(category)) return compareText(fileA, fileB);
  return compareByHash(fileA, fileB);
}
