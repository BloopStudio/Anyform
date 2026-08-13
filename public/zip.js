/**
 * Génère une archive ZIP à partir d'une liste de {name, blob}, utilisée par le
 * traitement par lot (Convertisseur/Compresseur, plusieurs fichiers à la fois) pour le
 * bouton "Télécharger tout". Implémentation pure JS du format ZIP, sans dépendance : le
 * format est simple à écrire correctement pour ce cas d'usage (créer une archive, jamais
 * en extraire) — méthode "stored" (pas de compression), les fichiers produits par Anyform
 * sont déjà dans leur format final, souvent déjà compressés (images/audio/vidéo).
 */

// Table précalculée pour crc32 : évite de refaire les 8 itérations de la boucle interne
// pour chaque octet, un classique de cet algorithme.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Le format ZIP stocke les dates au format DOS (16 bits heure, 16 bits date), pas en
// timestamp Unix — non significatif ici (juste pour l'horodatage affiché par les
// utilitaires d'extraction), donc l'heure de création de l'archive suffit pour tous les
// fichiers plutôt que la date de modification individuelle de chacun.
function dosDateTime(date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * Construit une archive ZIP (méthode stored) à partir d'une liste de fichiers.
 * @param {Array<{name: string, blob: Blob}>} entries
 * @returns {Promise<Blob>}
 */
async function createZipBlob(entries) {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    // Bit 11 (0x0800) du flag = "nom de fichier encodé en UTF-8" : sans ça, les
    // utilitaires ZIP plus anciens supposent du CP437 et déforment les accents.
    const nameBytes = encoder.encode(entry.name);
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(data);

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true); // version nécessaire
    localHeader.setUint16(6, 0x0800, true); // flags (UTF-8)
    localHeader.setUint16(8, 0, true); // méthode = stored
    localHeader.setUint16(10, time, true);
    localHeader.setUint16(12, day, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, data.length, true); // taille compressée = taille réelle
    localHeader.setUint32(22, data.length, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true); // extra field

    localParts.push(new Uint8Array(localHeader.buffer), nameBytes, data);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true); // version made by
    centralHeader.setUint16(6, 20, true); // version nécessaire
    centralHeader.setUint16(8, 0x0800, true); // flags (UTF-8)
    centralHeader.setUint16(10, 0, true); // méthode
    centralHeader.setUint16(12, time, true);
    centralHeader.setUint16(14, day, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, data.length, true);
    centralHeader.setUint32(24, data.length, true);
    centralHeader.setUint16(28, nameBytes.length, true);
    centralHeader.setUint16(30, 0, true); // extra field
    centralHeader.setUint16(32, 0, true); // commentaire
    centralHeader.setUint16(34, 0, true); // numéro de disque
    centralHeader.setUint16(36, 0, true); // attributs internes
    centralHeader.setUint32(38, 0, true); // attributs externes
    centralHeader.setUint32(42, offset, true); // offset du header local

    centralParts.push(new Uint8Array(centralHeader.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0);

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true); // numéro de disque
  end.setUint16(6, 0, true); // disque contenant le répertoire central
  end.setUint16(8, entries.length, true); // entrées sur ce disque
  end.setUint16(10, entries.length, true); // entrées au total
  end.setUint32(12, centralDirSize, true);
  end.setUint32(16, centralDirOffset, true);
  end.setUint16(20, 0, true); // commentaire d'archive

  return new Blob([...localParts, ...centralParts, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
