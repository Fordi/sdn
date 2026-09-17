import { test } from "node:test";
import assert from "node:assert/strict";
import { pad, formatDateTime, sliceAnsi } from "./logs.js";

test("pad: left-pads with zeros to the given width", () => {
  assert.equal(pad(5), "05");
  assert.equal(pad(42), "42");
  assert.equal(pad(5, 3), "005");
});

test("pad: does not truncate values wider than the target width", () => {
  assert.equal(pad(12345, 2), "12345");
});

test("formatDateTime: formats a morning time with 'a' suffix", () => {
  const d = new Date(2024, 2, 7, 9, 5, 3);
  assert.equal(formatDateTime(d), "2024-03-07 09:05:03a");
});

test("formatDateTime: formats an afternoon time with 'p' suffix and 12h hour", () => {
  const d = new Date(2024, 2, 7, 13, 30, 0);
  assert.equal(formatDateTime(d), "2024-03-07 01:30:00p");
});

test("formatDateTime: midnight hour formats as 12a", () => {
  const d = new Date(2024, 2, 7, 0, 0, 0);
  assert.equal(formatDateTime(d), "2024-03-07 12:00:00a");
});

test("formatDateTime: noon formats as 12p", () => {
  const d = new Date(2024, 2, 7, 12, 0, 0);
  assert.equal(formatDateTime(d), "2024-03-07 12:00:00p");
});

test("sliceAnsi: plain text within bounds returns it unchanged", () => {
  assert.equal(sliceAnsi("short", 0, 100), "short");
});

test("sliceAnsi: truncating mid-string appends the overflow marker", () => {
  assert.equal(sliceAnsi("hello world", 0, 4), "hell⇶");
});

test("sliceAnsi: open-ended slice (no end) drops the final character", () => {
  // Current behavior: aEnd defaults to text.length - 1, so the very last
  // character is always excluded when `end` is not provided.
  assert.equal(sliceAnsi("hello world", 6), "worl");
});

test("sliceAnsi: skips ANSI escape sequences when counting visible positions", () => {
  const RED = "\x1b[31m";
  assert.equal(sliceAnsi(`${RED}hello world`, 0, 4), `${RED}hell⇶`);
});

test("sliceAnsi: preserves escape sequences that fall within the slice", () => {
  const RED = "\x1b[31m";
  const RESET = "\x1b[0m";
  assert.equal(sliceAnsi(`${RED}hello${RESET} world`, 0), `${RED}hello${RESET} worl`);
});

test("sliceAnsi: slicing from a non-zero start offset", () => {
  assert.equal(sliceAnsi("hello world", 2, 6), "llo ⇶");
});
