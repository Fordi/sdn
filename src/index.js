#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { basename } from "node:path";

let cmd = process.argv[2];
if (!cmd) {
  console.warn(`${basename(process.argv[1])} {command} ...`);
  process.exit(-1);
}
const script = fileURLToPath(new URL(`./service/${cmd}.js`, import.meta.url));
process.argv.splice(1, 2, script);
await import(script);
