import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";

export const makeProjectFixture = (pkg = {}) => {
  const root = mkdtempSync(join(tmpdir(), "sdn-fixture-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "myproject", description: "d", main: "index.js", ...pkg }, null, 2),
    "utf8"
  );
  return root;
};

export const makeFakeHome = () => mkdtempSync(join(tmpdir(), "sdn-fakehome-"));

// Logs each invocation as one line of shell-quoted args to `<binDir>/systemctl.log`,
// so a test can make multiple systemctl calls in one run and inspect them all.
export const makeFakeSystemctl = () => {
  const binDir = mkdtempSync(join(tmpdir(), "sdn-fakebin-"));
  const log = join(binDir, "systemctl.log");
  const script = join(binDir, "systemctl");
  writeFileSync(script, `#!/usr/bin/env bash\necho "$@" >> ${JSON.stringify(log)}\n`, "utf8");
  chmodSync(script, 0o755);
  return {
    binDir,
    calls: () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : []),
  };
};

// Fakes journalctl by printing one newline-delimited JSON line per entry in
// `lines`, then idling (real `journalctl -f` never exits on its own either).
export const makeFakeJournalctl = (lines) => {
  const binDir = mkdtempSync(join(tmpdir(), "sdn-fakebin-"));
  const script = join(binDir, "journalctl");
  const body = lines.map((line) => `echo ${JSON.stringify(JSON.stringify(line))}`).join("\n");
  writeFileSync(script, `#!/usr/bin/env bash\n${body}\nsleep 30\n`, "utf8");
  chmodSync(script, 0o755);
  return binDir;
};

export const runNodeScript = (scriptPath, { cwd, env = {}, args = [] } = {}) =>
  spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

// For scripts that don't exit on their own (long-running servers/watchers),
// or that may themselves spawn further children (e.g. nodemon spawning the
// watched app). Spawned detached so it's its own process group leader --
// use killProcessGroup() to reliably tear down it and any of its children,
// since killing just the direct child can leave grandchildren orphaned.
export const spawnNodeScript = (scriptPath, { cwd, env = {}, args = [] } = {}) =>
  spawn(process.execPath, [scriptPath, ...args], {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
  });

export const killProcessGroup = (child, signal = "SIGKILL") => {
  try {
    process.kill(-child.pid, signal);
  } catch (e) {
    if (e.code !== "ESRCH") throw e;
  }
};
