import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getConfig } from "./config.js";

const lastCrashFile = (where) => {
  const { config } = getConfig(where);
  return resolve(config.appData, "lastCrash.json");
};

function serializeError(err) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

export function installCrashHandler(where = process.cwd()) {
  const file = lastCrashFile(where);

  clearLastCrash(where);

  // Node suppresses its default "print and exit(1)" behavior for both of
  // these events as soon as any listener is attached, so once we stow the
  // report we have to reproduce that default ourselves -- otherwise the
  // process would carry on (or exit 0), and nodemon would never see a crash.
  const stow = (type) => (err) => {
    const report = { type, time: new Date().toISOString(), error: serializeError(err) };
    mkdirSync(resolve(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify(report, null, 2), "utf8");
    console.error(err);
    process.exit(1);
  };

  const onUncaughtException = stow("uncaughtException");
  const onUnhandledRejection = stow("unhandledRejection");

  process.on("uncaughtException", onUncaughtException);
  process.on("unhandledRejection", onUnhandledRejection);

  return function uninstall() {
    process.off("uncaughtException", onUncaughtException);
    process.off("unhandledRejection", onUnhandledRejection);
  };
}

export function readLastCrash(where = process.cwd()) {
  const file = lastCrashFile(where);
  if (!existsSync(file)) {
    return null;
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

export function clearLastCrash(where = process.cwd()) {
  const file = lastCrashFile(where);
  rmSync(file, { force: true });
}
