import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLogViewer } from "./logViewer.js";

const makeStdout = ({ columns = 120, rows = 24 } = {}) => {
  const written = [];
  return {
    columns,
    rows,
    write: (chunk) => written.push(chunk),
    get written() { return written; },
  };
};

const payload = (overrides = {}) => ({
  sym: ' > ',
  stamp: '2024-03-07 09:05:03a',
  tag: undefined,
  priority: 'LOG',
  message: 'hello world',
  ...overrides,
});

describe("createLogViewer", () => {
  describe("pushHistory", () => {
    it("appends payloads to history", () => {
      const viewer = createLogViewer(makeStdout());
      viewer.pushHistory(payload({ message: 'one' }));
      viewer.pushHistory(payload({ message: 'two' }));
      assert.equal(viewer.history.length, 2);
      assert.equal(viewer.history[1].message, 'two');
    });

    it("caps history at the given limit, dropping the oldest entries", () => {
      const viewer = createLogViewer(makeStdout());
      for (let i = 0; i < 5; i++) {
        viewer.pushHistory(payload({ message: `msg${i}` }), 3);
      }
      assert.deepEqual(viewer.history.map((p) => p.message), ['msg2', 'msg3', 'msg4']);
    });
  });

  describe("drawMessage", () => {
    it("writes a line containing the stamp and message", () => {
      const stdout = makeStdout();
      const viewer = createLogViewer(stdout, { useColor: false });
      viewer.drawMessage(payload());
      assert.equal(stdout.written.length, 1);
      assert.match(stdout.written[0], /2024-03-07 09:05:03a/);
      assert.match(stdout.written[0], /hello world/);
    });

    it("omits the priority prefix for a plain LOG with no tag", () => {
      const stdout = makeStdout();
      const viewer = createLogViewer(stdout, { useColor: false });
      viewer.drawMessage(payload({ priority: 'LOG', tag: undefined }));
      assert.doesNotMatch(stdout.written[0], /\[LOG\]/);
    });

    it("includes a bracketed prefix for non-LOG priorities", () => {
      const stdout = makeStdout();
      const viewer = createLogViewer(stdout, { useColor: false });
      viewer.drawMessage(payload({ priority: 'ERR' }));
      assert.match(stdout.written[0], /\[ERR\]:/);
    });

    it("includes the tag in the prefix when present", () => {
      const stdout = makeStdout();
      const viewer = createLogViewer(stdout, { useColor: false });
      viewer.drawMessage(payload({ tag: 'myapp', priority: 'LOG' }));
      assert.match(stdout.written[0], /\[myapp LOG\]:/);
    });

    it("strips ANSI color codes from the message when useColor is false", () => {
      const stdout = makeStdout();
      const viewer = createLogViewer(stdout, { useColor: false });
      viewer.drawMessage(payload({ message: '\x1b[31mred\x1b[0m text' }));
      assert.doesNotMatch(stdout.written[0], /\x1b\[31m/);
      assert.match(stdout.written[0], /red text/);
    });

    it("preserves ANSI color codes in the message when useColor is true", () => {
      const stdout = makeStdout();
      const viewer = createLogViewer(stdout, { useColor: true });
      viewer.drawMessage(payload({ message: '\x1b[31mred\x1b[0m text' }));
      assert.match(stdout.written[0], /\x1b\[31m/);
    });

    it("resets tracked color state to '0' when a colored message has no escape codes", () => {
      const stdout = makeStdout();
      const viewer = createLogViewer(stdout, { useColor: true });
      viewer.drawMessage(payload({ message: '\x1b[31mred' }));
      assert.equal(viewer.state, '31');
      viewer.drawMessage(payload({ message: 'plain text' }));
      assert.equal(viewer.state, '0');
    });

    it("shortens the timestamp when the terminal is too narrow", () => {
      const stdout = makeStdout({ columns: 20 });
      const viewer = createLogViewer(stdout, { useColor: false });
      viewer.drawMessage(payload({ stamp: '2024-03-07 09:05:03a' }));
      assert.doesNotMatch(stdout.written[0], /2024-03-07/);
      assert.match(stdout.written[0], /09:05a/);
    });
  });

  describe("redraw", () => {
    it("clears the screen and redraws the visible tail of history", () => {
      const stdout = makeStdout({ rows: 2 });
      const viewer = createLogViewer(stdout, { useColor: false });
      viewer.pushHistory(payload({ message: 'one' }));
      viewer.pushHistory(payload({ message: 'two' }));
      viewer.pushHistory(payload({ message: 'three' }));
      viewer.redraw();
      assert.equal(stdout.written[0], '\x1b[2J\x1b[1;1H');
      const drawn = stdout.written.slice(1).join('');
      assert.doesNotMatch(drawn, /one/);
      assert.match(drawn, /two/);
      assert.match(drawn, /three/);
    });
  });

  describe("handleKeyPress", () => {
    it("calls exit() on Escape", () => {
      const viewer = createLogViewer(makeStdout());
      let exited = false;
      viewer.handleKeyPress('\x1B', { exit: () => { exited = true; } });
      assert.ok(exited);
    });

    it("calls exit() on 'x'", () => {
      const viewer = createLogViewer(makeStdout());
      let exited = false;
      viewer.handleKeyPress('x', { exit: () => { exited = true; } });
      assert.ok(exited);
    });

    it("'l' increases leftOffset and redraws", () => {
      const stdout = makeStdout({ columns: 100 });
      const viewer = createLogViewer(stdout);
      viewer.handleKeyPress('l');
      assert.equal(viewer.leftOffset, 20);
      assert.ok(stdout.written.length > 0);
    });

    it("'a' decreases leftOffset but does not go below zero", () => {
      const stdout = makeStdout({ columns: 100 });
      const viewer = createLogViewer(stdout);
      viewer.handleKeyPress('a');
      assert.equal(viewer.leftOffset, 0);
    });

    it("arrow-key aliases behave the same as their letter counterparts", () => {
      const stdout = makeStdout({ columns: 100 });
      const viewer = createLogViewer(stdout);
      viewer.handleKeyPress('\x1b[C');
      assert.equal(viewer.leftOffset, 20);
    });

    it("'y' increases tailOffset", () => {
      const stdout = makeStdout({ columns: 100 });
      const viewer = createLogViewer(stdout);
      viewer.handleKeyPress('y');
      assert.equal(viewer.tailOffset, 20);
    });

    it("'b' decreases tailOffset but does not go below zero", () => {
      const stdout = makeStdout({ columns: 100 });
      const viewer = createLogViewer(stdout);
      viewer.handleKeyPress('b');
      assert.equal(viewer.tailOffset, 0);
    });

    it("ignores unrecognized keys", () => {
      const stdout = makeStdout();
      const viewer = createLogViewer(stdout);
      viewer.handleKeyPress('q');
      assert.equal(viewer.leftOffset, 0);
      assert.equal(viewer.tailOffset, 0);
      assert.equal(stdout.written.length, 0);
    });
  });

  describe("useColor default", () => {
    it("defaults to the stdout's isTTY flag when not specified", () => {
      const stdout = makeStdout();
      stdout.isTTY = true;
      const viewer = createLogViewer(stdout);
      viewer.drawMessage(payload({ message: '\x1b[31mred\x1b[0m' }));
      assert.match(stdout.written[0], /\x1b\[31m/);
    });
  });
});
