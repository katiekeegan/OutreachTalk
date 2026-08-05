import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCookies,
  safeEqualStrings,
  signSession,
  verifySession
} from "../src/auth.js";

test("signed sessions round-trip and reject tampering", async () => {
  const secret = "this-is-a-test-secret-with-enough-length";
  const token = await signSession({ role: "moderator", exp: Date.now() + 10_000 }, secret);
  assert.equal((await verifySession(token, secret)).role, "moderator");
  assert.equal(await verifySession(`${token}x`, secret), null);
});

test("expired sessions are rejected", async () => {
  const secret = "this-is-a-test-secret-with-enough-length";
  const token = await signSession({ role: "facilitator", exp: Date.now() - 1 }, secret);
  assert.equal(await verifySession(token, secret), null);
});

test("passcode comparison and cookie parsing are deterministic", async () => {
  assert.equal(await safeEqualStrings("1234", "1234"), true);
  assert.equal(await safeEqualStrings("1234", "1235"), false);
  assert.deepEqual(parseCookies("a=1; outreach_session=abc.def"), { a: "1", outreach_session: "abc.def" });
});
