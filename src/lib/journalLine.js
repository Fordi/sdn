import { ansiEscRx } from "./ansi.js";

const decoder = new TextDecoder();

const PRIORITY_NAMES = {
  "7": "DBG",
  "3": "ERR",
  "4": "WRN",
  "6": "LOG",
};

export function parseJournalLine(line, formatDateTime) {
  const tag = line.SYSLOG_IDENTIFIER === 'node' ? undefined : line.SYSLOG_IDENTIFIER;
  const priority = PRIORITY_NAMES[line.PRIORITY];
  const time = parseInt(line.__REALTIME_TIMESTAMP.slice(0, -3));
  const sym = line._TRANSPORT === 'stdout' ? ' > ' : '‼> ';
  // Unwrap the line if it's an array of numbers
  const message = Array.isArray(line.MESSAGE) && (typeof line.MESSAGE[0] === 'number')
    ? decoder.decode(new Uint8Array(line.MESSAGE))
    : line.MESSAGE;
  const stamp = formatDateTime(new Date(time));
  return { sym, tag, priority, stamp, length: message.replace(ansiEscRx, '').length, message };
}
