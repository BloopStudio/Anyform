/**
 * Conversion de sous-titres SRT ⇄ VTT ⇄ ASS, en pur JavaScript (fichiers texte, pas
 * besoin de ffmpeg.wasm). Représentation interne commune : liste de { start, end, text }
 * (secondes, texte multi-ligne joint par \n).
 */

function pad(n, len) {
  return String(n).padStart(len, '0');
}

function splitTimeMs(seconds) {
  let total = Math.round(seconds * 1000);
  const ms = total % 1000;
  total = Math.floor(total / 1000);
  const s = total % 60;
  total = Math.floor(total / 60);
  const m = total % 60;
  const h = Math.floor(total / 60);
  return { h, m, s, ms };
}

function splitTimeCentis(seconds) {
  let total = Math.round(seconds * 100);
  const cs = total % 100;
  total = Math.floor(total / 100);
  const s = total % 60;
  total = Math.floor(total / 60);
  const m = total % 60;
  const h = Math.floor(total / 60);
  return { h, m, s, cs };
}

function parseTimeGeneric(str) {
  const m = /(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{1,3})/.exec(str);
  if (!m) return 0;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = parseInt(m[2], 10);
  const s = parseInt(m[3], 10);
  const ms = parseInt(m[4].padEnd(3, '0'), 10);
  return h * 3600 + min * 60 + s + ms / 1000;
}

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
  return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`;
}

/**
 * Parse du SRT ou du VTT (structurellement identiques : bloc = [identifiant optionnel],
 * ligne de temps "début --> fin", puis texte, séparés par des lignes vides).
 */
function parseSrtOrVtt(text) {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/^﻿/, '').replace(/^WEBVTT[^\n]*\n/, '');
  const blocks = cleaned.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const timeLineIndex = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIndex === -1) continue; // bloc NOTE/STYLE (VTT) ou non reconnu

    const m = /([\d:.,]+)\s*-->\s*([\d:.,]+)/.exec(lines[timeLineIndex]);
    if (!m) continue;

    const start = parseTimeGeneric(m[1]);
    const end = parseTimeGeneric(m[2]);
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
  const eventsMatch = /\[Events\]\n([\s\S]*?)(\n\[|$)/i.exec(cleaned);
  if (!eventsMatch) return [];

  const lines = eventsMatch[1].split('\n');
  let fields = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
  const formatLine = lines.find((l) => l.trim().toLowerCase().startsWith('format:'));
  if (formatLine) {
    fields = formatLine
      .slice(formatLine.indexOf(':') + 1)
      .split(',')
      .map((f) => f.trim());
  }

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
    const cueText = parts
      .slice(textIdx)
      .join(',')
      .replace(/\{[^}]*\}/g, '') // tags de style ASS ({\b1}, {\pos(...)}, ...)
      .replace(/\\N|\\n/g, '\n')
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
  return (
    cues
      .map((c, i) => `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}\n`)
      .join('\n')
      .trim() + '\n'
  );
}

function writeVtt(cues) {
  const body = cues.map((c) => `${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}\n`).join('\n');
  return (`WEBVTT\n\n${body}`).trim() + '\n';
}

// Style minimal unique ("Default") : ASS gère des styles riches (police, couleur, position)
// qui n'ont pas d'équivalent en SRT/VTT — perdus lors d'une conversion vers ASS, comme pour
// le sens inverse.
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
    const text = c.text.split('\n').join('\\N');
    return `Dialogue: 0,${formatAssTime(c.start)},${formatAssTime(c.end)},Default,,0,0,0,,${text}`;
  });
  return header + lines.join('\n') + '\n';
}

function writeSubtitle(cues, targetExt) {
  if (targetExt === 'srt') return writeSrt(cues);
  if (targetExt === 'vtt') return writeVtt(cues);
  if (targetExt === 'ass' || targetExt === 'ssa') return writeAss(cues);
  throw new Error(t('error.subtitleFormatUnsupported', { format: targetExt }));
}

const SUBTITLE_MIME = { srt: 'text/plain', vtt: 'text/vtt', ass: 'text/plain', ssa: 'text/plain' };

/**
 * Convertit un fichier de sous-titres et retourne un Blob.
 * @param {File} file
 * @param {'srt'|'vtt'|'ass'} targetExt
 */
async function convertSubtitle(file, targetExt) {
  const text = await file.text();
  const sourceExt = extensionOf(file);
  const cues = parseSubtitle(text, sourceExt);

  if (cues.length === 0) {
    throw new Error(t('error.subtitleUnrecognized'));
  }

  const output = writeSubtitle(cues, targetExt);
  return new Blob([output], { type: SUBTITLE_MIME[targetExt] || 'text/plain' });
}
