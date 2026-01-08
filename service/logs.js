#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config, getConfig } from "../lib/config.js";
import { shellQuote } from "../lib/shellQuote.js";
import { jsonCmd } from "../lib/jsonCmd.js";

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
  const argv = ['journalctl', '--user-unit', project.name, '-o', 'json', '-e', '-f'];
  console.info(`> ${shellQuote(argv)}`);
  return jsonCmd(argv[0], argv.slice(1));
}

const useColor = process.argv.slice(2).includes('--force-color') || process.stdout.isTTY;

// Only generate colors if on a terminal
const SET = (...states) => useColor ? `\x1b[${states.join(';')}m` : '';
const RESET = SET(0);
if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let state = '0';
  for await (const line of journalctl(process.argv.slice(2))) {
    const time = parseInt(line.__REALTIME_TIMESTAMP.slice(0, -3));
    const sym = line._TRANSPORT === 'stdout' ? ' > ' : '‼> ';
    // Unwrap the line if it's an array of numbers
    let message = Array.isArray(line.MESSAGE) && (typeof line.MESSAGE[0] === 'number')
      ? decoder.decode(new Uint8Array(line.MESSAGE))
      : line.MESSAGE;

    if (!useColor) {
      // Strip colors if not on a terminal
      message = message.replace(ansiEscRx, '');
    }

    // Reset and restore the current ANSI color state
    const output = `${RESET}${formatDateTime(new Date(time))}${sym}${SET(state)}${message}${RESET}`;

    // Capture the last esc[*m instance in the message, and store it to be restored before the next message.
    // Unnessesary if not on a terminal.
    if (useColor) {
      state = [...(message.matchAll(ansiEscRx) ?? [])].at(-1)?.[1] ?? '0';
    }
    console.log(output);
  }
}