#!/usr/bin/env node
import { getConfig } from "../lib/config.js";
import { createLogViewer } from "../lib/logViewer.js";
import { parseJournalLine } from "../lib/journalLine.js";
import { formatDateTime } from "../lib/dateFormat.js";
import { journalctl as defaultJournalctl } from "../lib/journalctl.js";
import { isMain } from "../lib/isMain.js";

export async function runLogs({
  argv,
  stdin,
  stdout,
  project,
  exit = () => process.exit(),
  journalctl = defaultJournalctl,
}) {
  const useColor = argv.slice(2).includes('--force-color') || stdout.isTTY;
  const viewer = createLogViewer(stdout, { useColor });

  if (stdin.isTTY) {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', (key) => {
      if (key === '\x03') {
        exit();
        return;
      }
      viewer.handleKeyPress(key, { exit });
    });
  }

  stdout.on('resize', () => viewer.redraw());

  viewer.redraw();
  for await (const line of journalctl(project)) {
    const payload = parseJournalLine(line, formatDateTime);
    viewer.pushHistory(payload);
    viewer.drawMessage(payload);
  }
}

if (isMain(import.meta.url)) {
  const { config: project } = getConfig(process.cwd());
  await runLogs({ argv: process.argv, stdin: process.stdin, stdout: process.stdout, project });
}
