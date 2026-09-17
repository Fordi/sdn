import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pad, formatDateTime } from "../../src/lib/dateFormat.js";

describe("pad", () => {
  it("left-pads with zeros to the given width", () => {
    assert.equal(pad(5), "05");
    assert.equal(pad(42), "42");
    assert.equal(pad(5, 3), "005");
  });

  it("does not truncate values wider than the target width", () => {
    assert.equal(pad(12345, 2), "12345");
  });
});

describe("formatDateTime", () => {
  it("formats a morning time with 'a' suffix", () => {
    const d = new Date(2024, 2, 7, 9, 5, 3);
    assert.equal(formatDateTime(d), "2024-03-07 09:05:03a");
  });

  it("formats an afternoon time with 'p' suffix and 12h hour", () => {
    const d = new Date(2024, 2, 7, 13, 30, 0);
    assert.equal(formatDateTime(d), "2024-03-07 01:30:00p");
  });

  it("midnight hour formats as 12a", () => {
    const d = new Date(2024, 2, 7, 0, 0, 0);
    assert.equal(formatDateTime(d), "2024-03-07 12:00:00a");
  });

  it("noon formats as 12p", () => {
    const d = new Date(2024, 2, 7, 12, 0, 0);
    assert.equal(formatDateTime(d), "2024-03-07 12:00:00p");
  });
});
