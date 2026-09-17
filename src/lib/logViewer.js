import { sliceAnsi, ansiEscRx } from "./ansi.js";

export function createLogViewer(stdout, { useColor = stdout.isTTY } = {}) {
  const SET = (...states) => useColor ? `\x1b[${states.join(';')}m` : '';
  const RESET = SET(0);

  const history = [];
  let leftOffset = 0;
  let tailOffset = 0;
  let state = '0';

  const pushHistory = (payload, limit = 2000) => {
    history.push(payload);
    while (history.length > limit) {
      history.shift();
    }
  };

  const drawMessage = ({ sym, stamp, tag, priority, message }) => {
    if (!useColor) {
      // Strip colors if not on a terminal
      message = message.replace(ansiEscRx, '');
    }
    if (stdout.columns < (stamp.length + 3) * 4) {
      stamp = stamp.replace(/^\d{4}-\d{2}-\d{2} /, '').replace(/:\d{2}([ap])/, '$1');
    }
    const stampLen = (stamp.length + 4);
    const cols = stdout.columns;
    const prefix = (tag || priority !== 'LOG') ? `[${tag ? `${tag} ` : ''}${priority}]: ` : '';
    // Reset and restore the current ANSI color state
    const output = `${RESET}${stamp}${sym}${SET(state)}${prefix}${sliceAnsi(message, leftOffset, leftOffset + cols - stampLen)}${RESET}`;

    // Capture the last esc[*m instance in the message, and store it to be restored before the next message.
    // Unnessesary if not on a terminal.
    if (useColor) {
      state = [...(message.matchAll(ansiEscRx) ?? [])].at(-1)?.[1] ?? '0';
    }
    stdout.write(`${output}\n`);
  };

  const redraw = () => {
    stdout.write('\x1b[2J\x1b[1;1H');
    for (const payload of history.slice(-stdout.rows - tailOffset, tailOffset ? -tailOffset : undefined)) {
      drawMessage(payload);
    }
  };

  const handleKeyPress = (key, { exit } = {}) => {
    if (key === '\x1B' || key === 'x') {
      exit?.();
      return;
    }
    switch (key) {
      case 'a':
      case '\x1b[D':
        leftOffset = Math.max(0, leftOffset - Math.round(stdout.columns * 0.20));
        redraw();
        break;
      case 'l':
      case '\x1b[C':
        leftOffset += Math.round(stdout.columns * 0.20);
        redraw();
        break;
      case 'y':
      case '\x1b[A':
        tailOffset += Math.round(stdout.columns * 0.20);
        redraw();
        break;
      case 'b':
      case '\x1b[B':
        tailOffset = Math.max(0, tailOffset - Math.round(stdout.columns * 0.20));
        redraw();
        break;
      default:
    }
  };

  return {
    pushHistory,
    drawMessage,
    redraw,
    handleKeyPress,
    get history() { return history; },
    get leftOffset() { return leftOffset; },
    get tailOffset() { return tailOffset; },
    get state() { return state; },
  };
}
