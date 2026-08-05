"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { loadEnvFile, normalizeBasePath } = require("./lib/env");
const { ExerciseStore } = require("./lib/store");
const {
  safeEqual,
  signSession,
  verifySession,
  parseCookies,
  sessionCookie,
  clearSessionCookie
} = require("./lib/auth");

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const BASE_PATH = normalizeBasePath(process.env.APP_BASE_PATH || "/OutreachTalk");
const PUBLIC_DIR = path.join(__dirname, "public");
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, "data", "exercise-state.json");
const MODERATOR_PASSCODE = process.env.MODERATOR_PASSCODE || "change-me";
const FACILITATOR_PASSCODE = process.env.FACILITATOR_PASSCODE || MODERATOR_PASSCODE;
const SESSION_SECRET = process.env.SESSION_SECRET || "development-only-session-secret-change-me";
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || "");
const COOKIE_TTL_MS = 6 * 60 * 60 * 1000;

if (process.env.NODE_ENV === "production") {
  const weak = [];
  if (MODERATOR_PASSCODE === "change-me") weak.push("MODERATOR_PASSCODE");
  if (FACILITATOR_PASSCODE === "change-me-too") weak.push("FACILITATOR_PASSCODE");
  if (SESSION_SECRET.includes("development-only") || SESSION_SECRET.length < 32) weak.push("SESSION_SECRET");
  if (weak.length) {
    console.error(`Refusing production startup: configure ${weak.join(", ")}.`);
    process.exit(1);
  }
}

const store = new ExerciseStore(STATE_FILE);
const eventClients = new Set();
const rateBuckets = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function requestProtocol(req) {
  if (TRUST_PROXY && req.headers["x-forwarded-proto"]) return String(req.headers["x-forwarded-proto"]).split(",")[0].trim();
  return req.socket.encrypted ? "https" : "http";
}

function requestOrigin(req) {
  return `${requestProtocol(req)}://${req.headers.host}`;
}

function isSecure(req) {
  return requestProtocol(req) === "https";
}

function requestIp(req) {
  if (TRUST_PROXY && req.headers["x-forwarded-for"]) return String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function securityHeaders(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'self'"
  );
  if (isSecure(req)) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(body);
}

function sendError(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

async function readJson(req, limit = 16_384) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error("Request body is too large.");
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.code = "INVALID_JSON";
    throw error;
  }
}

function requireSameOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (origin === requestOrigin(req)) return true;
  sendError(res, 403, "ORIGIN_MISMATCH", "This action must come from the OutreachTalk site.");
  return false;
}

function allowRate(key, { limit, windowMs }) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie).outreach_session;
  return verifySession(token, SESSION_SECRET);
}

function requireRole(req, res, allowedRoles) {
  const session = getSession(req);
  if (!session || !allowedRoles.includes(session.role)) {
    sendError(res, 401, "AUTH_REQUIRED", "Enter the staff passcode to continue.");
    return null;
  }
  return session;
}

function normalizeSubmissionText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function validParticipantId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}

function publicEvent() {
  return JSON.stringify(store.publicSnapshot());
}

function broadcastState() {
  const data = publicEvent();
  for (const res of eventClients) {
    try {
      res.write(`event: state\ndata: ${data}\n\n`);
    } catch {
      eventClients.delete(res);
    }
  }
}

async function handleApi(req, res, relativePath, url) {
  if (req.method === "GET" && relativePath === "/api/state") {
    return sendJson(res, 200, store.publicSnapshot());
  }

  if (req.method === "GET" && relativePath === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`event: state\ndata: ${publicEvent()}\n\n`);
    eventClients.add(res);
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 15_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      eventClients.delete(res);
    });
    return;
  }

  if (req.method === "GET" && relativePath === "/api/submissions/mine") {
    const participantId = url.searchParams.get("participantId");
    if (!validParticipantId(participantId)) return sendError(res, 400, "INVALID_PARTICIPANT", "A valid participant ID is required.");
    return sendJson(res, 200, { submissions: store.mine(participantId), exercise: store.publicSnapshot().exercise });
  }

  if (req.method === "POST" && relativePath === "/api/submissions") {
    if (!requireSameOrigin(req, res)) return;
    const ip = requestIp(req);
    if (!allowRate(`submit:${ip}`, { limit: 30, windowMs: 60_000 })) {
      return sendError(res, 429, "RATE_LIMITED", "Too many submissions. Please pause for a moment.");
    }
    const body = await readJson(req);
    const participantId = body.participantId;
    const text = normalizeSubmissionText(body.text);
    if (!validParticipantId(participantId)) return sendError(res, 400, "INVALID_PARTICIPANT", "Refresh the page and try again.");
    if (text.length < 4 || text.length > 180) return sendError(res, 400, "INVALID_TEXT", "Use between 4 and 180 characters.");
    try {
      const submission = await store.submit({ participantId, text });
      broadcastState();
      return sendJson(res, 201, { submission });
    } catch (error) {
      if (error.code === "EXERCISE_FINALIZED") return sendError(res, 423, error.code, "The facilitator finalized this exercise, so new submissions are locked.");
      throw error;
    }
  }

  if (relativePath === "/api/auth" && req.method === "GET") {
    const session = getSession(req);
    return sendJson(res, 200, { authenticated: Boolean(session), role: session?.role || null, expiresAt: session?.exp || null });
  }

  if (relativePath === "/api/auth" && req.method === "POST") {
    if (!requireSameOrigin(req, res)) return;
    const ip = requestIp(req);
    if (!allowRate(`auth:${ip}`, { limit: 10, windowMs: 15 * 60_000 })) {
      return sendError(res, 429, "RATE_LIMITED", "Too many passcode attempts. Try again later.");
    }
    const body = await readJson(req);
    const requestedRole = body.role === "facilitator" ? "facilitator" : "moderator";
    const expected = requestedRole === "facilitator" ? FACILITATOR_PASSCODE : MODERATOR_PASSCODE;
    if (!safeEqual(body.passcode || "", expected)) return sendError(res, 401, "INVALID_PASSCODE", "That passcode is not correct.");
    const exp = Date.now() + COOKIE_TTL_MS;
    const token = signSession({ role: requestedRole, exp, nonce: crypto.randomUUID() }, SESSION_SECRET);
    return sendJson(res, 200, { authenticated: true, role: requestedRole, expiresAt: exp }, {
      "Set-Cookie": sessionCookie({ token, basePath: BASE_PATH, secure: isSecure(req), maxAgeSeconds: COOKIE_TTL_MS / 1000 })
    });
  }

  if (relativePath === "/api/auth" && req.method === "DELETE") {
    if (!requireSameOrigin(req, res)) return;
    return sendJson(res, 200, { authenticated: false }, {
      "Set-Cookie": clearSessionCookie({ basePath: BASE_PATH, secure: isSecure(req) })
    });
  }

  if (req.method === "GET" && relativePath === "/api/moderator/submissions") {
    if (!requireRole(req, res, ["moderator"])) return;
    return sendJson(res, 200, store.moderatorSnapshot());
  }

  const moderationMatch = relativePath.match(/^\/api\/moderator\/submissions\/([a-f0-9-]+)$/i);
  if (req.method === "PATCH" && moderationMatch) {
    if (!requireSameOrigin(req, res)) return;
    if (!requireRole(req, res, ["moderator"])) return;
    const body = await readJson(req);
    if (!["approved", "rejected"].includes(body.status)) return sendError(res, 400, "INVALID_STATUS", "Status must be approved or rejected.");
    try {
      const submission = await store.setStatus(moderationMatch[1], body.status);
      broadcastState();
      return sendJson(res, 200, { submission });
    } catch (error) {
      if (error.code === "NOT_FOUND") return sendError(res, 404, error.code, error.message);
      throw error;
    }
  }

  if (req.method === "POST" && relativePath === "/api/exercise/finalize") {
    if (!requireSameOrigin(req, res)) return;
    if (!requireRole(req, res, ["facilitator", "moderator"])) return;
    const exercise = await store.finalize();
    broadcastState();
    return sendJson(res, 200, { exercise });
  }

  if (req.method === "POST" && relativePath === "/api/exercise/reopen") {
    if (!requireSameOrigin(req, res)) return;
    if (!requireRole(req, res, ["facilitator", "moderator"])) return;
    const exercise = await store.reopen();
    broadcastState();
    return sendJson(res, 200, { exercise });
  }

  if (req.method === "POST" && relativePath === "/api/exercise/reset") {
    if (!requireSameOrigin(req, res)) return;
    if (!requireRole(req, res, ["facilitator", "moderator"])) return;
    const body = await readJson(req);
    if (body.confirm !== "RESET") return sendError(res, 400, "CONFIRMATION_REQUIRED", "Type RESET to clear the exercise.");
    await store.reset();
    broadcastState();
    return sendJson(res, 200, { state: store.publicSnapshot() });
  }

  return sendError(res, 404, "NOT_FOUND", "API route not found.");
}

function mapStaticPath(relativePath) {
  const clean = relativePath.replace(/\/+$/, "") || "/";
  if (clean === "/") return "index.html";
  if (clean === "/play") return "play/index.html";
  if (clean === "/moderator") return "moderator/index.html";
  if (clean === "/lab") return "lab/index.html";
  return clean.replace(/^\//, "");
}

async function serveStatic(req, res, relativePath) {
  let filePath = path.resolve(PUBLIC_DIR, mapStaticPath(relativePath));
  if (!filePath.startsWith(path.resolve(PUBLIC_DIR) + path.sep) && filePath !== path.resolve(PUBLIC_DIR, "index.html")) {
    return sendError(res, 403, "FORBIDDEN", "Invalid path.");
  }
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) filePath = path.join(filePath, "index.html");
    const body = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const cache = extension === ".html" ? "no-cache" : "public, max-age=300";
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": cache
    });
    if (req.method === "HEAD") return res.end();
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") return sendError(res, 404, "NOT_FOUND", "Page not found.");
    throw error;
  }
}

async function requestHandler(req, res) {
  securityHeaders(req, res);
  try {
    const url = new URL(req.url, requestOrigin(req));
    const pathname = decodeURIComponent(url.pathname);

    if (BASE_PATH && pathname === "/") {
      res.writeHead(302, { Location: `${BASE_PATH}/` });
      return res.end();
    }
    if (BASE_PATH && !(pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`))) {
      return sendError(res, 404, "NOT_FOUND", "Page not found.");
    }

    const relativePath = BASE_PATH ? (pathname.slice(BASE_PATH.length) || "/") : pathname;
    if (relativePath.startsWith("/api/")) return await handleApi(req, res, relativePath, url);
    if (!["GET", "HEAD"].includes(req.method)) return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    return await serveStatic(req, res, relativePath);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      if (error.code === "PAYLOAD_TOO_LARGE") return sendError(res, 413, error.code, error.message);
      if (error.code === "INVALID_JSON") return sendError(res, 400, error.code, error.message);
      return sendError(res, 500, "INTERNAL_ERROR", "The server could not complete that request.");
    }
    res.end();
  }
}

async function start() {
  await store.init();
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}${BASE_PATH || ""}/`;
    console.log(`OutreachTalk live exercise running at ${url}`);
    console.log(`State file: ${path.resolve(STATE_FILE)}`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { start, requestHandler, store, BASE_PATH };
