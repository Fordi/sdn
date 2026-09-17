import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { EventEmitter } from "node:events";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeFakeJournalctl, makeProjectFixture, spawnNodeScript, killProcessGroup } from "./testSupport.js";
import { runLogs } from "./logs.js";

const here = dirname(fileURLToPath(import.meta.url));
const logsScript = join(here, "logs.js");

const waitFor = async (predicate, { timeoutMs = 3000, intervalMs = 50 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
};

const cleanup = (...dirs) => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("logs.js (the journalctl-backed viewer entry point)", () => {
  it("prints formatted journal entries read through the real journalctl→viewer pipeline", async (t) => {
    const root = makeProjectFixture({ name: "logsviewerapp" });
    const binDir = makeFakeJournalctl([
      {
        SYSLOG_IDENTIFIER: "node",
        PRIORITY: "6",
        __REALTIME_TIMESTAMP: "1789679067578327",
        _TRANSPORT: "stdout",
        MESSAGE: "hello from the fake journal",
      },
    ]);
    const child = spawnNodeScript(logsScript, {
      cwd: root,
      env: { PATH: `${binDir}:${process.env.PATH}` },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, binDir);
    });

    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });

    // sliceAnsi truncates the trailing character when no explicit end column
    // is reached (see lib/ansi.test.js), so assert on the prefix.
    const gotOutput = await waitFor(() => output.includes("hello from the fake journ"));
    assert.ok(gotOutput, `expected journal output; got: ${JSON.stringify(output)}`);
  });

  it("prints a bracketed priority prefix for a non-LOG entry", async (t) => {
    const root = makeProjectFixture({ name: "logsviewerapp2" });
    const binDir = makeFakeJournalctl([
      {
        SYSLOG_IDENTIFIER: "node",
        PRIORITY: "3",
        __REALTIME_TIMESTAMP: "1789679067578327",
        _TRANSPORT: "stderr",
        MESSAGE: "something broke",
      },
    ]);
    const child = spawnNodeScript(logsScript, {
      cwd: root,
      env: { PATH: `${binDir}:${process.env.PATH}` },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, binDir);
    });

    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });

    const gotOutput = await waitFor(() => output.includes("something brok"));
    assert.ok(gotOutput, `expected journal output; got: ${JSON.stringify(output)}`);
    assert.match(output, /\[ERR\]:/);
  });
});

const makeFakeStdout = ({ isTTY = false, columns = 120, rows = 24 } = {}) => {
  const stream = new EventEmitter();
  stream.isTTY = isTTY;
  stream.columns = columns;
  stream.rows = rows;
  stream.written = [];
  stream.write = (chunk) => { stream.written.push(chunk); };
  return stream;
};

const makeFakeStdin = ({ isTTY = false } = {}) => {
  const stream = new EventEmitter();
  stream.isTTY = isTTY;
  stream.setRawMode = () => {};
  stream.resume = () => {};
  stream.setEncoding = () => {};
  return stream;
};

// Yields each of `lines`, then hangs (like a real `journalctl -f`) until the
// test drops its reference -- runLogs' `for await` loop only ever needs the
// entries a test asserts on, so there's nothing to explicitly stop.
async function* fakeJournalctlLines(lines) {
  for (const line of lines) {
    yield line;
  }
  await new Promise(() => {});
}

describe("runLogs", () => {
  it("prints formatted journal entries via the viewer", async () => {
    const stdout = makeFakeStdout();
    const stdin = makeFakeStdin();
    const journalctl = () => fakeJournalctlLines([
      {
        SYSLOG_IDENTIFIER: "node",
        PRIORITY: "6",
        __REALTIME_TIMESTAMP: "1789679067578327",
        _TRANSPORT: "stdout",
        MESSAGE: "hello there",
      },
    ]);

    runLogs({ argv: ["node", "logs.js"], stdin, stdout, project: { name: "p" }, journalctl });

    await new Promise((r) => setTimeout(r, 50));
    const output = stdout.written.join("");
    assert.match(output, /hello there/);
  });

  it("does not set up stdin key handling when stdin is not a TTY", async () => {
    const stdout = makeFakeStdout();
    const stdin = makeFakeStdin({ isTTY: false });
    const journalctl = () => fakeJournalctlLines([]);

    runLogs({ argv: ["node", "logs.js"], stdin, stdout, project: { name: "p" }, journalctl });

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(stdin.listenerCount("data"), 0);
  });

  it("sets up raw-mode stdin key handling when stdin is a TTY", async () => {
    const stdout = makeFakeStdout();
    const stdin = makeFakeStdin({ isTTY: true });
    const journalctl = () => fakeJournalctlLines([]);

    runLogs({ argv: ["node", "logs.js"], stdin, stdout, project: { name: "p" }, journalctl });

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(stdin.listenerCount("data"), 1);
  });

  it("calls exit() when stdin receives Ctrl-C (\\x03)", async () => {
    const stdout = makeFakeStdout();
    const stdin = makeFakeStdin({ isTTY: true });
    const journalctl = () => fakeJournalctlLines([]);
    let exited = false;

    runLogs({
      argv: ["node", "logs.js"],
      stdin,
      stdout,
      project: { name: "p" },
      journalctl,
      exit: () => { exited = true; },
    });

    await new Promise((r) => setTimeout(r, 10));
    stdin.emit("data", "\x03");
    assert.ok(exited);
  });

  it("forwards other keys to the viewer's handleKeyPress", async () => {
    const stdout = makeFakeStdout();
    const stdin = makeFakeStdin({ isTTY: true });
    const journalctl = () => fakeJournalctlLines([]);

    runLogs({ argv: ["node", "logs.js"], stdin, stdout, project: { name: "p" }, journalctl });

    await new Promise((r) => setTimeout(r, 10));
    stdout.written.length = 0;
    stdin.emit("data", "l");
    // 'l' pans right and triggers a redraw, which clears the screen.
    assert.ok(stdout.written.some((chunk) => chunk.includes("\x1b[2J")));
  });

  it("redraws when stdout emits a resize event", async () => {
    const stdout = makeFakeStdout();
    const stdin = makeFakeStdin();
    const journalctl = () => fakeJournalctlLines([]);

    runLogs({ argv: ["node", "logs.js"], stdin, stdout, project: { name: "p" }, journalctl });

    await new Promise((r) => setTimeout(r, 10));
    stdout.written.length = 0;
    stdout.emit("resize");
    assert.ok(stdout.written.some((chunk) => chunk.includes("\x1b[2J")));
  });

  it("passes --force-color through argv to enable color even without a TTY", async () => {
    const stdout = makeFakeStdout({ isTTY: false });
    const stdin = makeFakeStdin();
    const journalctl = () => fakeJournalctlLines([
      {
        SYSLOG_IDENTIFIER: "node",
        PRIORITY: "6",
        __REALTIME_TIMESTAMP: "1789679067578327",
        _TRANSPORT: "stdout",
        MESSAGE: "\x1b[31mred text",
      },
    ]);

    runLogs({
      argv: ["node", "logs.js", "--force-color"],
      stdin,
      stdout,
      project: { name: "p" },
      journalctl,
    });

    await new Promise((r) => setTimeout(r, 50));
    const output = stdout.written.join("");
    assert.match(output, /\x1b\[31m/);
  });
});
