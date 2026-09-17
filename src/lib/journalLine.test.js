import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseJournalLine } from "./journalLine.js";

const stubFormatDateTime = (date) => `STAMP(${date.getTime()})`;

const baseLine = (overrides = {}) => ({
  SYSLOG_IDENTIFIER: "myapp",
  PRIORITY: "6",
  __REALTIME_TIMESTAMP: "1789679067578327",
  _TRANSPORT: "stdout",
  MESSAGE: "hello world",
  ...overrides,
});

describe("parseJournalLine", () => {
  it("keeps the tag when SYSLOG_IDENTIFIER is not 'node'", () => {
    const payload = parseJournalLine(baseLine({ SYSLOG_IDENTIFIER: "myapp" }), stubFormatDateTime);
    assert.equal(payload.tag, "myapp");
  });

  it("drops the tag when SYSLOG_IDENTIFIER is 'node'", () => {
    const payload = parseJournalLine(baseLine({ SYSLOG_IDENTIFIER: "node" }), stubFormatDateTime);
    assert.equal(payload.tag, undefined);
  });

  it("maps known PRIORITY codes to their short names", () => {
    const cases = { "7": "DBG", "3": "ERR", "4": "WRN", "6": "LOG" };
    for (const [code, name] of Object.entries(cases)) {
      const payload = parseJournalLine(baseLine({ PRIORITY: code }), stubFormatDateTime);
      assert.equal(payload.priority, name);
    }
  });

  it("maps an unrecognized PRIORITY code to undefined", () => {
    const payload = parseJournalLine(baseLine({ PRIORITY: "0" }), stubFormatDateTime);
    assert.equal(payload.priority, undefined);
  });

  it("truncates __REALTIME_TIMESTAMP from microseconds to milliseconds before formatting", () => {
    const payload = parseJournalLine(baseLine({ __REALTIME_TIMESTAMP: "1789679067578327" }), stubFormatDateTime);
    assert.equal(payload.stamp, "STAMP(1789679067578)");
  });

  it("uses the stdout symbol for a stdout transport", () => {
    const payload = parseJournalLine(baseLine({ _TRANSPORT: "stdout" }), stubFormatDateTime);
    assert.equal(payload.sym, " > ");
  });

  it("uses the non-stdout symbol for any other transport", () => {
    const payload = parseJournalLine(baseLine({ _TRANSPORT: "syslog" }), stubFormatDateTime);
    assert.equal(payload.sym, "‼> ");
  });

  it("passes a plain string message through unchanged", () => {
    const payload = parseJournalLine(baseLine({ MESSAGE: "plain message" }), stubFormatDateTime);
    assert.equal(payload.message, "plain message");
  });

  it("decodes an array-of-bytes message as UTF-8 text", () => {
    const bytes = [...Buffer.from("byte message", "utf8")];
    const payload = parseJournalLine(baseLine({ MESSAGE: bytes }), stubFormatDateTime);
    assert.equal(payload.message, "byte message");
  });

  it("computes length from the message with ANSI codes stripped", () => {
    const payload = parseJournalLine(baseLine({ MESSAGE: "\x1b[31mred\x1b[0m text" }), stubFormatDateTime);
    assert.equal(payload.length, "red text".length);
  });
});
