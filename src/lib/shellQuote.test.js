import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shellQuote } from "./shellQuote.js";

describe("shellQuote", () => {
  it("empty string quotes to ''", () => {
    assert.equal(shellQuote(""), "''");
  });

  it("leaves safe strings unquoted", () => {
    for (const s of ["abc", "ABC123", "a.b-c_d/e:f=g@h,i%j+k"]) {
      assert.equal(shellQuote(s), s);
    }
  });

  it("quotes strings with spaces", () => {
    assert.equal(shellQuote("hello world"), "'hello world'");
  });

  it("quotes and escapes embedded single quotes", () => {
    assert.equal(shellQuote("it's"), `'it'\\''s'`);
  });

  it("quotes shell metacharacters", () => {
    for (const s of ["$HOME", "`cmd`", "a;b", "a|b", "a&b", "a(b)", "a\"b"]) {
      const quoted = shellQuote(s);
      assert.equal(quoted[0], "'");
      assert.equal(quoted[quoted.length - 1], "'");
    }
  });

  it("joins multiple args with spaces, quoting each independently", () => {
    assert.equal(shellQuote("a", "b c", "d"), "a 'b c' d");
  });

  it("joins an array of args, quoting each independently", () => {
    assert.equal(shellQuote(["a", "b c", "'d'"]), `a 'b c' ''\\''d'\\'''`);
  });

  it("array form and multi-arg form agree", () => {
    const args = ["safe", "not safe", "it's"];
    assert.equal(shellQuote(args), shellQuote(...args));
  });
});
