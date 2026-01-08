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
export const formatJournal = (line) => {
  const time = parseInt(line.__REALTIME_TIMESTAMP.slice(0, -3));
  const sym = line._TRANSPORT === 'stdout' ? ' > ' : '‼> ';
  const message = Array.isArray(line.MESSAGE) ? decoder.decode(new Uint8Array(line.MESSAGE)) : line.MESSAGE;
  return `${formatDateTime(new Date(time))}${sym}${message}`;
}

export function journalctl() {
  const argv = ['journalctl', '--user-unit', project.name, '-o', 'json', '-e', '-f'];
  console.info(`> ${shellQuote(argv)}`);
  return jsonCmd(argv[0], argv.slice(1));
}
console.log(process.argv);
if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  for await (const line of journalctl(process.argv.slice(2))) {
    console.log(formatJournal(line));
  }
}