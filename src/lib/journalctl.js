import { shellQuote } from "./shellQuote.js";
import { jsonCmd } from "./jsonCmd.js";

export function journalctl(project) {
  const argv = ['journalctl', '--user-unit', project.name];
  for (const unit of project.otherUnits ?? []) {
    argv.push(`--user-unit`, unit);
  }
  argv.push('-o', 'json', '-e', '-f');
  console.info(`> ${shellQuote(argv)}`);
  return jsonCmd(argv[0], argv.slice(1));
}
