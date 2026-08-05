import test from "node:test";
import assert from "node:assert/strict";
import { assetPathFor, normalizeBasePath } from "../src/worker.js";

test("base paths normalize consistently", () => {
  assert.equal(normalizeBasePath(""), "");
  assert.equal(normalizeBasePath("/"), "");
  assert.equal(normalizeBasePath("OutreachTalk"), "/OutreachTalk");
  assert.equal(normalizeBasePath("//OutreachTalk//"), "/OutreachTalk");
});

test("role routes map to their static entry points", () => {
  assert.equal(assetPathFor("/"), "/index.html");
  assert.equal(assetPathFor("/play/"), "/play/index.html");
  assert.equal(assetPathFor("/moderator"), "/moderator/index.html");
  assert.equal(assetPathFor("/lab/"), "/lab/index.html");
  assert.equal(assetPathFor("/role.css"), "/role.css");
});
