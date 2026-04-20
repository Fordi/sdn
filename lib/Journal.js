import { inspect } from "node:util";
import { WriteStream } from "node:tty";
import { shellQuote } from "./shellQuote.js";
import { spawn } from "node:child_process";

const normalize = (args) => {
  if (args.length === 1 && typeof args[0] === 'string') {
    args = args[0];
  } else {
    args = args.map((arg) => inspect(arg, { color: true })).join('\xa0');
  }
  return args;
}

const logOut = process.env.INVOCATION_ID
? async (type, tag, args) => {
  args = normalize(args);
  let priority = {
    "debug": "debug",
    "warn": "warning",
    "error": "err",
    "info": "info",
    "log": "log",
  }[type] ?? "info";
  const proc = spawn('systemd-cat', ['-t', tag, '-p', priority], { stdio: ['pipe', 'ignore', 'ignore'] });
  proc.stdin.write(args);
  proc.unref();
}
: async (type, tag, args) => new Promise((resolve, reject) => {
  args = normalize(args);
  const priority = {
    "debug": "DBG",
    "error": "ERR",
    "warn": "WRN",
    "log": "LOG",
    "info": "LOG",
  }[type] ?? "LOG";
  const stream = {
    "debug": process.stdout,
    "error": process.stderr,
    "warn": process.stderr,
    "log": process.stdout,
    "info": process.stdout,
  }[type] ?? process.stdout;
  return stream.write(`[${tag ? `${tag} ` : ''}${priority}]:\xa0${args}\n`, (err) => {
    if (err) {
      reject(err);
    } else {
      resolve();
    }
  });
});

// TODO: wrap console:
// console.tag(name: string): Logger implements Console
