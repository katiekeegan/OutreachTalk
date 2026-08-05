"use strict";

const crypto = require("node:crypto");

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signSession(payload, secret) {
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySession(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [encoded, supplied] = token.split(".", 2);
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!safeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || payload.exp < Date.now() || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header = "") {
  const cookies = {};
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index < 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function sessionCookie({ token, basePath, secure, maxAgeSeconds = 21600 }) {
  const path = basePath || "/";
  const fields = [
    `outreach_session=${encodeURIComponent(token)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (secure) fields.push("Secure");
  return fields.join("; ");
}

function clearSessionCookie({ basePath, secure }) {
  return sessionCookie({ token: "", basePath, secure, maxAgeSeconds: 0 });
}

module.exports = { safeEqual, signSession, verifySession, parseCookies, sessionCookie, clearSessionCookie };
