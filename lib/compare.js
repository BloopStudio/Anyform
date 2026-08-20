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
 *
 * La table dp est stockée à plat dans un seul Int32Array((n+1)×(m+1)) plutôt qu'un tableau
 * de tableaux JS : jusqu'à 4x moins de mémoire (entiers 32 bits contigus au lieu d'objets
 * "number" boxés dans (n+1) tableaux séparés) et un accès plus rapide (une seule allocation,
 * meilleure localité de cache) — significatif au plafond MAX_DIFF_LINES (3000×3000 ≈ 9M
 * cellules).
 */
function diffLines(linesA, linesB) {
  const n = linesA.length;
  const m = linesB.length;
  const stride = m + 1;
  const dp = new Int32Array((n + 1) * stride);

  for (let i = n - 1; i >= 0; i--) {
    const row = i * stride;
    const nextRow = row + stride;
    for (let j = m - 1; j >= 0; j--) {
      dp[row + j] = linesA[i] === linesB[j]
        ? dp[nextRow + j + 1] + 1
        : Math.max(dp[nextRow + j], dp[row + j + 1]);
    }
  }

  const result = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (linesA[i] === linesB[j]) {
      result.push({ type: 'equal', text: linesA[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * stride + j] >= dp[i * stride + j + 1]) {
      result.push({ type: 'removed', text: linesA[i] });
      removed++;
      i++;
    } else {
      result.push({ type: 'added', text: linesB[j] });
      added++;
      j++;
    }
  }
  while (i < n) {
    result.push({ type: 'removed', text: linesA[i] });
    removed++;
    i++;
  }
  while (j < m) {
    result.push({ type: 'added', text: linesB[j] });
    added++;
    j++;
  }

  result.added = added;
  result.removed = removed;
  return result;
}

// Empreinte SHA-256 d'un fichier via un flux plutôt qu'un chargement complet en mémoire
// (fs.readFileSync) : la comparaison par empreinte est le repli utilisé pour l'audio/vidéo,
// souvent les plus gros fichiers manipulés par Anyform — en streaming, la mémoire utilisée
// reste bornée à la taille d'un chunk (~64 Ko) au lieu de charger tout le fichier d'un coup.
function sha256Hex(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Compare deux fichiers par empreinte SHA-256 — mode de repli utilisé pour tout ce qui
 * n'a pas de diff dédiée (image/texte) : audio, vidéo, polices, PDF, archives, etc. Les deux
 * empreintes sont calculées en parallèle plutôt que l'une après l'autre.
 */
async function compareByHash(pathA, pathB) {
  const [hashA, hashB] = await Promise.all([sha256Hex(pathA), sha256Hex(pathB)]);
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
async function compareText(pathA, pathB) {
  const linesA = fs.readFileSync(pathA, 'utf8').split('\n');
  const linesB = fs.readFileSync(pathB, 'utf8').split('\n');

  if (linesA.length > MAX_DIFF_LINES || linesB.length > MAX_DIFF_LINES) {
    const result = await compareByHash(pathA, pathB);
    result.tooLarge = true;
    return result;
  }

  const diff = diffLines(linesA, linesB);
  const { added, removed } = diff;

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
  // Une seule instance sharp par fichier, réutilisée pour metadata() puis pour le pipeline
  // raw() : évite de rouvrir/redécoder deux fois le même fichier (une fois par appel
  // `sharp(path)`). Les deux fichiers sont aussi traités en parallèle plutôt que l'un après
  // l'autre.
  const pipelineA = sharp(pathA);
  const pipelineB = sharp(pathB);
  const [metaA, metaB] = await Promise.all([pipelineA.metadata(), pipelineB.metadata()]);

  const width = Math.min(metaA.width, metaB.width);
  const height = Math.min(metaA.height, metaB.height);
  const sizeMismatch = metaA.width !== metaB.width || metaA.height !== metaB.height;

  const [pixelsA, pixelsB] = await Promise.all([
    pipelineA.resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer(),
    pipelineB.resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer(),
  ]);

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
