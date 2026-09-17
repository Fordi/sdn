#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getConfig } from "../lib/config.js";
import { shellQuote } from "../lib/shellQuote.js";
import { jsonCmd } from "../lib/jsonCmd.js";
import { ansiEscRx } from "../lib/ansi.js";
import { createLogViewer } from "../lib/logViewer.js";

const { config: project } = getConfig(process.cwd());

export const pad = (n, l = 2) => String(n).padStart(l, '0');

export const formatDateTime = (date) => {
  const d = `${pad(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const g = date.getHours();
  const h = g % 12 || 12;
  const a = g < 12 ? 'a' : 'p';
  const t = `${pad(h)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${a}`;
  return `${d} ${t}`;
}
const decoder = new TextDecoder();

export function journalctl() {
  const argv = ['journalctl', '--user-unit', project.name];
  for (const unit of project.otherUnits ?? []) {
    argv.push(`--user-unit`, unit);
  }
  argv.push('-o', 'json', '-e', '-f');
  console.info(`> ${shellQuote(argv)}`);
  return jsonCmd(argv[0], argv.slice(1));
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const useColor = process.argv.slice(2).includes('--force-color') || process.stdout.isTTY;
  const viewer = createLogViewer(process.stdout, { useColor });

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key) => {
      if (key === '\x03') {
        process.exit();
      }
      viewer.handleKeyPress(key, { exit: () => process.exit() });
    });
  }

  process.stdout.on('resize', () => viewer.redraw());

  viewer.redraw();
  for await (const line of journalctl(process.argv.slice(2))) {
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
    viewer.pushHistory(payload);
    viewer.drawMessage(payload);
  }
}
