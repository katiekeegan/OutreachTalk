const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function safeEqualStrings(left, right) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(left))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(right)))
  ]);
  return constantTimeEqual(new Uint8Array(leftHash), new Uint8Array(rightHash));
}

export async function signSession(payload, secret) {
  const encoded = stringToBase64Url(JSON.stringify(payload));
  const signature = bytesToBase64Url(await hmac(encoded, secret));
  return `${encoded}.${signature}`;
}

export async function verifySession(token, secret) {
  if (!token || !token.includes(".") || !secret) return null;
  const [encoded, supplied] = token.split(".", 2);
  try {
    const expected = await hmac(encoded, secret);
    const suppliedBytes = base64UrlToBytes(supplied);
    if (!constantTimeEqual(expected, suppliedBytes)) return null;
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(encoded)));
    if (!payload?.role || !Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header = "") {
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

export function sessionCookie({ token, basePath = "", maxAgeSeconds = 21600 }) {
  return [
    `outreach_session=${encodeURIComponent(token)}`,
    `Path=${basePath || "/"}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

export function clearSessionCookie({ basePath = "" }) {
  return sessionCookie({ token: "", basePath, maxAgeSeconds: 0 });
}

export async function hashSubject(value, secret) {
  return bytesToBase64Url(await hmac(String(value), secret));
}
