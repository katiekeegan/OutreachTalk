"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { safeEqual, signSession, verifySession, parseCookies } = require("../lib/auth");

test("signed sessions round-trip and reject tampering", () => {
  const secret = "this-is-a-test-secret-with-enough-length";
  const token = signSession({ role: "moderator", exp: Date.now() + 10_000 }, secret);
  assert.equal(verifySession(token, secret).role, "moderator");
  assert.equal(verifySession(`${token}x`, secret), null);
});

test("expired sessions are rejected", () => {
  const secret = "this-is-a-test-secret-with-enough-length";
  const token = signSession({ role: "facilitator", exp: Date.now() - 1 }, secret);
  assert.equal(verifySession(token, secret), null);
});

test("passcode comparison and cookie parsing are deterministic", () => {
  assert.equal(safeEqual("1234", "1234"), true);
  assert.equal(safeEqual("1234", "1235"), false);
  assert.deepEqual(parseCookies("a=1; outreach_session=abc.def"), { a: "1", outreach_session: "abc.def" });
});
