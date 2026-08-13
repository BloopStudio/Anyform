/**
 * Conversion de sous-titres SRT ⇄ VTT ⇄ ASS, en pur JavaScript (fichiers texte, aucune
 * dépendance). Représentation interne commune : liste de { start, end, text } (secondes,
 * texte multi-ligne joint par \n). Portage direct de public/subtitles.js (web/desktop/
 * extension) pour le CLI.
 */

const SUBTITLE_FORMATS = ['srt', 'vtt', 'ass', 'ssa'];

// Complète un nombre avec des zéros à gauche (ex: pad(5, 2) -> "05"), utilisé pour
// formater les heures/minutes/secondes/millisecondes des timecodes.
function pad(n, len) {
  return String(n).padStart(len, '0');
}

// Découpe un nombre de secondes (flottant) en heures/minutes/secondes/millisecondes,
// pour le format SRT/VTT (précision à la milliseconde). On travaille en millisecondes
// entières dès le départ (Math.round) pour éviter les erreurs d'arrondi en cascade que
// donnerait un calcul direct en flottant sur les secondes.
function splitTimeMs(seconds) {
  let total = Math.round(seconds * 1000); // total en ms, entier
  const ms = total % 1000;
  total = Math.floor(total / 1000); // total en secondes entières restantes
  const s = total % 60;
  total = Math.floor(total / 60); // total en minutes entières restantes
  const m = total % 60;
  const h = Math.floor(total / 60); // heures restantes (peut dépasser 24)
  return { h, m, s, ms };
}

// Même découpage que splitTimeMs, mais en centisecondes (précision ASS, 2 chiffres après
// la virgule au lieu de 3).
function splitTimeCentis(seconds) {
  let total = Math.round(seconds * 100); // total en centisecondes, entier
  const cs = total % 100;
  total = Math.floor(total / 100);
  const s = total % 60;
  total = Math.floor(total / 60);
  const m = total % 60;
  const h = Math.floor(total / 60);
  return { h, m, s, cs };
}

// Parse un timecode SRT ("00:00:01,000") ou VTT ("00:00:01.000", ou "00:01.000" sans
// heures — VTT autorise d'omettre les heures si nulles). Un seul regex gère les deux
// séparateurs de millisecondes (virgule SRT, point VTT) grâce à la classe [.,].
function parseTimeGeneric(str) {
  const m = /(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{1,3})/.exec(str);
  if (!m) return 0;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = parseInt(m[2], 10);
  const s = parseInt(m[3], 10);
  // padEnd : "5" (dixièmes) doit valoir 500ms, pas 5ms -> on complète à droite avant de
  // parser, pas à gauche comme pad() qui sert à l'écriture.
  const ms = parseInt(m[4].padEnd(3, '0'), 10);
  return h * 3600 + min * 60 + s + ms / 1000;
}

// Parse un timecode ASS, format "H:MM:SS.cc" (heures sans zéro de tête, centisecondes).
function parseAssTime(str) {
  const m = /(\d+):(\d{2}):(\d{2})\.(\d{2})/.exec(str);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const s = parseInt(m[3], 10);
  const cs = parseInt(m[4], 10);
  return h * 3600 + min * 60 + s + cs / 100;
}

function formatSrtTime(seconds) {
  const { h, m, s, ms } = splitTimeMs(seconds);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function formatVttTime(seconds) {
  const { h, m, s, ms } = splitTimeMs(seconds);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
}

function formatAssTime(seconds) {
  const { h, m, s, cs } = splitTimeCentis(seconds);
  // Pas de pad() sur les heures en ASS : le format standard n'a qu'un seul chiffre
  // d'heure ("0:00:01.00", pas "00:00:01.00").
  return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`;
}

/**
 * Parse du SRT ou du VTT (structurellement identiques : bloc = [identifiant optionnel],
 * ligne de temps "début --> fin", puis texte, séparés par des lignes vides).
 */
function parseSrtOrVtt(text) {
  // Normalise les fins de ligne Windows, retire un éventuel BOM UTF-8 en tête de fichier,
  // et l'en-tête "WEBVTT" (propre au VTT, absent en SRT).
  const cleaned = text.replace(/\r\n/g, '\n').replace(/^﻿/, '').replace(/^WEBVTT[^\n]*\n/, '');
  // Un bloc = un sous-titre. Les blocs sont séparés par une ou plusieurs lignes vides.
  const blocks = cleaned.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    // La ligne de temps ("00:00:01,000 --> 00:00:04,000") peut être précédée d'un
    // identifiant de bloc (numéro en SRT, identifiant textuel optionnel en VTT) : on la
    // cherche plutôt que de supposer qu'elle est toujours en première position.
    const timeLineIndex = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIndex === -1) continue; // bloc NOTE/STYLE (VTT) ou non reconnu, ignoré

    const m = /([\d:.,]+)\s*-->\s*([\d:.,]+)/.exec(lines[timeLineIndex]);
    if (!m) continue;

    const start = parseTimeGeneric(m[1]);
    const end = parseTimeGeneric(m[2]);
    // Tout ce qui suit la ligne de temps jusqu'à la fin du bloc est le texte (peut être
    // multi-ligne, ex. deux lignes de sous-titre affichées en même temps).
    const cueText = lines.slice(timeLineIndex + 1).join('\n').trim();
    if (!cueText) continue;

    cues.push({ start, end, text: cueText });
  }

  return cues;
}

/**
 * Parse la section [Events] d'un fichier ASS/SSA. Ne supporte que le texte et le timing —
 * le style (police, couleur, position) n'est pas préservé lors d'une conversion vers/depuis
 * SRT/VTT, qui n'ont pas ces notions.
 */
function parseAss(text) {
  const cleaned = text.replace(/\r\n/g, '\n');
  // La section [Events] va jusqu'à la prochaine section "[...]" ou la fin du fichier.
  const eventsMatch = /\[Events\]\n([\s\S]*?)(\n\[|$)/i.exec(cleaned);
  if (!eventsMatch) return [];

  const lines = eventsMatch[1].split('\n');
  // Ordre de champs par défaut au cas où la ligne "Format:" serait absente (rare, mais le
  // format ASS ne l'impose pas techniquement) — c'est l'ordre standard du spec v4+.
  let fields = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
  const formatLine = lines.find((l) => l.trim().toLowerCase().startsWith('format:'));
  if (formatLine) {
    fields = formatLine
      .slice(formatLine.indexOf(':') + 1)
      .split(',')
      .map((f) => f.trim());
  }

  // Position de chaque champ qui nous intéresse dans la liste "Format:" — permet de
  // retrouver Start/End/Text même si l'ordre des champs diffère d'un fichier à l'autre.
  const startIdx = fields.indexOf('Start');
  const endIdx = fields.indexOf('End');
  const textIdx = fields.indexOf('Text');
  const cues = [];

  for (const line of lines) {
    if (!line.trim().toLowerCase().startsWith('dialogue:')) continue;
    const parts = line.slice(line.indexOf(':') + 1).split(',');
    if (parts.length <= textIdx || startIdx === -1 || endIdx === -1) continue;

    const start = parseAssTime(parts[startIdx].trim());
    const end = parseAssTime(parts[endIdx].trim());
    // Text est toujours le dernier champ du format ASS et peut lui-même contenir des
    // virgules (dialogue normal) : on rejoint tout ce qui reste après textIdx au lieu de
    // ne prendre que parts[textIdx], sinon on tronquerait le texte à la première virgule.
    const cueText = parts
      .slice(textIdx)
      .join(',')
      .replace(/\{[^}]*\}/g, '') // tags de style ASS ({\b1}, {\pos(...)}, ...), retirés
      .replace(/\\N|\\n/g, '\n') // \N (et \n) = saut de ligne explicite en ASS
      .trim();

    if (!cueText) continue;
    cues.push({ start, end, text: cueText });
  }

  return cues;
}

function parseSubtitle(text, sourceExt) {
  if (sourceExt === 'ass' || sourceExt === 'ssa') return parseAss(text);
  return parseSrtOrVtt(text);
}

function writeSrt(cues) {
  // Chaque bloc : numéro d'ordre (1-indexé, obligatoire en SRT), timecode, texte, ligne
  // vide. Le .trim() final + "\n" évite une ligne vide surnuméraire en fin de fichier.
  return (
    cues
      .map((c, i) => `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}\n`)
      .join('\n')
      .trim() + '\n'
  );
}

function writeVtt(cues) {
  // Pas de numéro de bloc obligatoire en VTT (contrairement au SRT), juste l'en-tête
  // "WEBVTT" suivi d'une ligne vide puis des blocs.
  const body = cues.map((c) => `${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}\n`).join('\n');
  return (`WEBVTT\n\n${body}`).trim() + '\n';
}

// Style minimal unique ("Default") : ASS gère des styles riches (police, couleur, position)
// qui n'ont pas d'équivalent en SRT/VTT — perdus lors d'une conversion vers ASS, comme pour
// le sens inverse. L'en-tête ci-dessous est le strict minimum pour produire un fichier ASS
// valide et lisible par n'importe quel lecteur vidéo.
function writeAss(cues) {
  const header = `[Script Info]
Title: Anyform
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines = cues.map((c) => {
    // \N est le saut de ligne du format ASS (un simple \n dans le fichier serait interprété
    // comme la fin de la ligne "Dialogue:", pas comme un retour à la ligne dans le texte).
    const text = c.text.split('\n').join('\\N');
    return `Dialogue: 0,${formatAssTime(c.start)},${formatAssTime(c.end)},Default,,0,0,0,,${text}`;
  });
  return header + lines.join('\n') + '\n';
}

function writeSubtitle(cues, targetExt) {
  if (targetExt === 'srt') return writeSrt(cues);
  if (targetExt === 'vtt') return writeVtt(cues);
  if (targetExt === 'ass' || targetExt === 'ssa') return writeAss(cues);
  throw new Error(`Format de sous-titres non supporté : ${targetExt}`);
}

/**
 * Convertit un texte de sous-titres d'un format vers un autre.
 * @param {string} text
 * @param {string} sourceExt
 * @param {'srt'|'vtt'|'ass'} targetExt
 * @returns {string}
 */
function convertSubtitle(text, sourceExt, targetExt) {
  const cues = parseSubtitle(text, sourceExt);

  if (cues.length === 0) {
    throw new Error('Aucun sous-titre reconnu dans ce fichier — vérifie que le format est valide.');
  }

  return writeSubtitle(cues, targetExt);
}

module.exports = { convertSubtitle, SUBTITLE_FORMATS };
