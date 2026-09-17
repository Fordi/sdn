import { spawnSync } from "node:child_process";
import { shellQuote } from "./shellQuote.js";

export function systemctl(project, [cmd, ...args]) {
  const argv = ['systemctl', '--user', ...(cmd ? [cmd, project.name] : []), ...args];
  console.info(`> ${shellQuote(argv)}`);
  return spawnSync(argv[0], argv.slice(1), { stdio: "inherit" });
}
