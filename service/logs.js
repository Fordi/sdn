#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getConfig } from "../lib/config.js";
import { shellQuote } from "../lib/shellQuote.js";
import { jsonCmd } from "../lib/jsonCmd.js";
import { stdin } from "node:process";

const { config: project } = getConfig(process.cwd());

const pad = (n, l = 2) => String(n).padStart(l, '0');

const formatDateTime = (date) => {
  const d = `${pad(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const g = date.getHours();
  const h = g % 12 || 12;
  const a = g < 12 ? 'a' : 'p';
  const t = `${pad(h)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${a}`;
  return `${d} ${t}`;
}
const decoder = new TextDecoder();
const ansiEscRx = /\x1b\[([\d;]+)m/g;
export const formatJournal = (line) => {
}

export function journalctl() {
  const argv = ['journalctl', '--user-unit', project.name];
  for (const unit of project.otherUnits ?? []) {
    argv.push(`--user-unit`, unit);
  }
  argv.push('-o', 'json', '-e', '-f');
  console.info(`> ${shellQuote(argv)}`);
  return jsonCmd(argv[0], argv.slice(1));
}

const useColor = process.argv.slice(2).includes('--force-color') || process.stdout.isTTY;

let leftOffset = 0;
let tailOffset = 0;

const handleKeyPress = (key) => {
  if (key === '\x1B' || key === 'x') {
    process.exit();
  }
  switch (key) {
    case 'a':
    case '\x1b[D':
      leftOffset = Math.max(0, leftOffset - Math.round(process.stdout.columns * 0.20));
      redraw();
      break;
    case 'l':
    case '\x1b[C':
      leftOffset += Math.round(process.stdout.columns * 0.20);
      redraw();
      break;
    case 'y':
    case '\x1b[A':
      tailOffset += Math.round(process.stdout.columns * 0.20);
      redraw();
      break;
    case 'b':
    case '\x1b[B':
      tailOffset = Math.max(0, tailOffset - Math.round(process.stdout.columns * 0.20));
      redraw();
    default:
  }
};

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (key) => {
    if (key === '\x03') {
      process.exit();
    }
    handleKeyPress(key);
  });
}

function sliceAnsi(text, start, end) {
  let i = 0, j = 0;
  text = [...text];
  for (; i < start; i++, j++) {
    if (text[j] === '\x1b') {
      const m = text.slice(j).join('').match(ansiEscRx);
      j += m[0].length;
    }
  }
  const aStart = j;
  let aEnd = text.length - 1;
  if (end) {
    for (; i <= end; i++, j++) {
      if (text[j] === '\x1b') {
        const m = text.slice(j).join('').match(ansiEscRx);
        j += m[0].length;
      }
    }
    aEnd = j;
  }
  let append = '';
  if (aEnd < text.length - 1) {
    aEnd = aEnd - 1;
    append = '⇶'
  }

  return [...text.slice(aStart, aEnd), append].join('');
}
function drawMessage({ sym, stamp, tag, priority, message }) {
  if (!useColor) {
    // Strip colors if not on a terminal
    message = message.replace(ansiEscRx, '');
  }
  if (process.stdout.columns < (stamp.length + 3) * 4) {
    stamp = stamp.replace(/^\d{4}-\d{2}-\d{2} /, '').replace(/:\d{2}([ap])/, '$1');
  }
  const stampLen = (stamp.length + 4);
  const cols = process.stdout.columns;
  const prefix = (tag || priority !== 'LOG') ? `[${tag ? `${tag} ` : ''}${priority}]: ` : '';
  // Reset and restore the current ANSI color state
  const output = `${RESET}${stamp}${sym}${SET(state)}${prefix}${sliceAnsi(message, leftOffset, leftOffset + cols - stampLen)}${RESET}`;

  // Capture the last esc[*m instance in the message, and store it to be restored before the next message.
  // Unnessesary if not on a terminal.
  if (useColor) {
    state = [...(message.matchAll(ansiEscRx) ?? [])].at(-1)?.[1] ?? '0';
  }
  console.log(output);
}

function redraw() {
  process.stdout.write('\x1b[2J\x1b[1;1H');
  for (const payload of history.slice(-process.stdout.rows - tailOffset, tailOffset ? -tailOffset : undefined)) {
    drawMessage(payload);
  }
}

process.stdout.on('resize', () => redraw());

// Only generate colors if on a terminal
const SET = (...states) => useColor ? `\x1b[${states.join(';')}m` : '';
const RESET = SET(0);
const history = [];
let needsRedraw = false;
let state = '0';
if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  redraw();
  for await (const line of journalctl(process.argv.slice(2))) {
    if (needsRedraw) {

    }
    const tag = line.SYSLOG_IDENTIFIER === 'node' ? undefined : line.SYSLOG_IDENTIFIER;
    const priority = {
      "7": "DBG",
      "3": "ERR",
      "4": "WRN",
      "6": "LOG",
    }[line.PRIORITY];
    const time = parseInt(line.__REALTIME_TIMESTAMP.slice(0, -3));
    const sym = line._TRANSPORT === 'stdout' ? ' > ' : '‼> ';
    // Unwrap the line if it's an array of numbers
    let message = Array.isArray(line.MESSAGE) && (typeof line.MESSAGE[0] === 'number')
      ? decoder.decode(new Uint8Array(line.MESSAGE))
      : line.MESSAGE;
    let stamp = formatDateTime(new Date(time));
    const payload = { sym, tag, priority, stamp, length: message.replace(ansiEscRx, '').length, message };
    history.push(payload);
    while (history.length > 2000) {
      history.shift();
    }
    drawMessage(payload);
  }
}