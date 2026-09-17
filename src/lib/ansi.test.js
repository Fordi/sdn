import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sliceAnsi } from "./ansi.js";

describe("sliceAnsi", () => {
  it("plain text within bounds returns it unchanged", () => {
    assert.equal(sliceAnsi("short", 0, 100), "short");
  });

  it("truncating mid-string appends the overflow marker", () => {
    assert.equal(sliceAnsi("hello world", 0, 4), "hell⇶");
  });

  it("open-ended slice (no end) drops the final character", () => {
    // Current behavior: aEnd defaults to text.length - 1, so the very last
    // character is always excluded when `end` is not provided.
    assert.equal(sliceAnsi("hello world", 6), "worl");
  });

  it("skips ANSI escape sequences when counting visible positions", () => {
    const RED = "\x1b[31m";
    assert.equal(sliceAnsi(`${RED}hello world`, 0, 4), `${RED}hell⇶`);
  });

  it("preserves escape sequences that fall within the slice", () => {
    const RED = "\x1b[31m";
    const RESET = "\x1b[0m";
    assert.equal(sliceAnsi(`${RED}hello${RESET} world`, 0), `${RED}hello${RESET} worl`);
  });

  it("slicing from a non-zero start offset", () => {
    assert.equal(sliceAnsi("hello world", 2, 6), "llo ⇶");
  });

  it("skips an escape sequence encountered before a non-zero start offset", () => {
    const RED = "\x1b[31m";
    assert.equal(sliceAnsi(`${RED}hello world`, 2, 6), `llo ⇶`);
  });
});
