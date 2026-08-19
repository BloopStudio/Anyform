/**
 * Comparateur : seul mode à deux entrées (fichier A / fichier B) au lieu d'un seul.
 * Portage de public/compare.js (web/desktop/extension) pour le CLI — même logique
 * (diff pixel par pixel pour les images, diff ligne à ligne pour le texte, empreinte
 * SHA-256 pour le reste), mais via `sharp` (raw pixels) et le module `crypto` de Node
 * au lieu de Canvas et `crypto.subtle`.
 */

const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const TEXT_DIFF_CATEGORIES = ['data', 'subtitle'];
// Au-delà de cette taille, la diff ligne à ligne (LCS, coût O(n×m) en temps ET en mémoire)
// deviendrait trop lente/gourmande — on retombe sur la comparaison par empreinte.
const MAX_DIFF_LINES = 3000;

/**
 * Diff ligne à ligne par plus longue sous-séquence commune (LCS), méthode standard
 * derrière `diff`/`git diff`. Identique à public/compare.js — voir ce fichier pour le
 * détail du fonctionnement de dp[i][j] et du backtrack.
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

// Empreinte SHA-256 d'un fichier lu en entier en mémoire — suffisant pour les tailles de
// fichiers qu'Anyform manipule, pas besoin d'un hachage en streaming.
function sha256Hex(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * Compare deux fichiers par empreinte SHA-256 — mode de repli utilisé pour tout ce qui
 * n'a pas de diff dédiée (image/texte) : audio, vidéo, polices, PDF, archives, etc.
 */
function compareByHash(pathA, pathB) {
  const hashA = sha256Hex(pathA);
  const hashB = sha256Hex(pathB);
  return {
    type: 'hash',
    identical: hashA === hashB,
    hashA,
    hashB,
    sizeA: fs.statSync(pathA).size,
    sizeB: fs.statSync(pathB).size,
  };
}

/**
 * Compare deux fichiers texte (données/sous-titres) ligne à ligne via diffLines. Retombe
 * sur compareByHash si l'un des deux dépasse MAX_DIFF_LINES, pour éviter le coût O(n×m)
 * du LCS sur de gros fichiers.
 */
function compareText(pathA, pathB) {
  const linesA = fs.readFileSync(pathA, 'utf8').split('\n');
  const linesB = fs.readFileSync(pathB, 'utf8').split('\n');

  if (linesA.length > MAX_DIFF_LINES || linesB.length > MAX_DIFF_LINES) {
    const result = compareByHash(pathA, pathB);
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
 * Compare deux images pixel par pixel sur leur zone commune (redimensionnées au plus
 * petit des deux rectangles si les dimensions diffèrent) et produit un buffer PNG de
 * diff : pixels identiques en niveaux de gris atténués, pixels qui changent en rouge.
 */
async function compareImages(pathA, pathB) {
  const metaA = await sharp(pathA).metadata();
  const metaB = await sharp(pathB).metadata();

  const width = Math.min(metaA.width, metaB.width);
  const height = Math.min(metaA.height, metaB.height);
  const sizeMismatch = metaA.width !== metaB.width || metaA.height !== metaB.height;

  const pixelsA = await sharp(pathA).resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const pixelsB = await sharp(pathB).resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();

  const totalPixels = width * height;
  const outBuffer = Buffer.alloc(totalPixels * 4);

  // Seuil au-delà duquel un pixel est considéré "différent" (somme des écarts R+G+B) :
  // évite de signaler du bruit de compression JPEG imperceptible comme une vraie diff.
  const THRESHOLD = 30;
  let diffCount = 0;

  for (let p = 0; p < totalPixels; p++) {
    const o = p * 4;
    const dr = Math.abs(pixelsA[o] - pixelsB[o]);
    const dg = Math.abs(pixelsA[o + 1] - pixelsB[o + 1]);
    const db = Math.abs(pixelsA[o + 2] - pixelsB[o + 2]);
    const different = dr + dg + db > THRESHOLD;

    if (different) {
      diffCount++;
      outBuffer[o] = 255;
      outBuffer[o + 1] = 0;
      outBuffer[o + 2] = 0;
      outBuffer[o + 3] = 255;
    } else {
      // Pixel identique : affiché en gris atténué pour que les zones rouges ressortent
      // clairement au premier coup d'œil.
      const gray = Math.round((pixelsA[o] + pixelsA[o + 1] + pixelsA[o + 2]) / 3 / 2);
      outBuffer[o] = gray;
      outBuffer[o + 1] = gray;
      outBuffer[o + 2] = gray;
      outBuffer[o + 3] = 255;
    }
  }

  const diffBuffer = await sharp(outBuffer, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const percentIdentical = totalPixels > 0 ? Math.round(((totalPixels - diffCount) / totalPixels) * 1000) / 10 : 100;

  return {
    type: 'image',
    identical: diffCount === 0 && !sizeMismatch,
    percentIdentical,
    diffBuffer,
    sizeMismatch,
    dimensionsA: `${metaA.width} × ${metaA.height}`,
    dimensionsB: `${metaB.width} × ${metaB.height}`,
  };
}

/**
 * Compare deux fichiers et retourne un résultat dont la forme dépend de `category` :
 * image (diff visuelle), data/subtitle (diff texte), tout le reste (empreinte SHA-256).
 * @param {string} pathA
 * @param {string} pathB
 * @param {string} category
 */
async function compareFiles(pathA, pathB, category) {
  if (category === 'image') return compareImages(pathA, pathB);
  if (TEXT_DIFF_CATEGORIES.includes(category)) return compareText(pathA, pathB);
  return compareByHash(pathA, pathB);
}

module.exports = { compareFiles };
