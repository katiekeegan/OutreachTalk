import {
  allowRate,
  ensureSchema,
  mine,
  moderatorSnapshot,
  publicSnapshot,
  resetExercise,
  setFinalized,
  setStatus,
  submit
} from "./db.js";
import {
  clearSessionCookie,
  hashSubject,
  parseCookies,
  safeEqualStrings,
  sessionCookie,
  signSession,
  verifySession
} from "./auth.js";

const COOKIE_TTL_MS = 6 * 60 * 60 * 1000;
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'self'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
};

function normalizeBasePath(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
      ...extraHeaders
    }
  });
}

function errorResponse(status, code, message) {
  return json({ error: { code, message } }, status);
}

async function readJson(request, limit = 16_384) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > limit) {
    const error = new Error("Request body is too large.");
    error.code = "PAYLOAD_TOO_LARGE";
    throw error;
  }
  const text = await request.text();
  if (text.length > limit) {
    const error = new Error("Request body is too large.");
    error.code = "PAYLOAD_TOO_LARGE";
    throw error;
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.code = "INVALID_JSON";
    throw error;
  }
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function normalizeSubmissionText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function validParticipantId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}

function clientAddress(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

async function getSession(request, env) {
  if (!env.SESSION_SECRET) return null;
  const token = parseCookies(request.headers.get("cookie") || "").outreach_session;
  return verifySession(token, env.SESSION_SECRET);
}

async function requireRole(request, env, allowedRoles) {
  const session = await getSession(request, env);
  return session && allowedRoles.includes(session.role) ? session : null;
}

function checkConfiguration(env, names) {
  return names.filter(name => !env[name]);
}

async function handleApi(request, env, relativePath, url, basePath) {
  await ensureSchema(env.DB);

  if (request.method === "GET" && relativePath === "/api/state") {
    return json(await publicSnapshot(env.DB));
  }

  if (request.method === "GET" && relativePath === "/api/submissions/mine") {
    const participantId = url.searchParams.get("participantId");
    if (!validParticipantId(participantId)) return errorResponse(400, "INVALID_PARTICIPANT", "A valid participant ID is required.");
    const [submissions, state] = await Promise.all([mine(env.DB, participantId), publicSnapshot(env.DB)]);
    return json({ submissions, exercise: state.exercise });
  }

  if (request.method === "POST" && relativePath === "/api/submissions") {
    if (!sameOrigin(request)) return errorResponse(403, "ORIGIN_MISMATCH", "This action must come from the OutreachTalk site.");
    const missing = checkConfiguration(env, ["SESSION_SECRET"]);
    if (missing.length) return errorResponse(503, "CONFIGURATION_ERROR", `Missing Worker secret: ${missing.join(", ")}.`);
    const body = await readJson(request);
    const participantId = body.participantId;
    const text = normalizeSubmissionText(body.text);
    if (!validParticipantId(participantId)) return errorResponse(400, "INVALID_PARTICIPANT", "Refresh the page and try again.");
    if (text.length < 4 || text.length > 180) return errorResponse(400, "INVALID_TEXT", "Use between 4 and 180 characters.");
    const subjectHash = await hashSubject(`${clientAddress(request)}:${participantId}`, env.SESSION_SECRET);
    const allowed = await allowRate(env.DB, { subjectHash, action: "submit", limit: 30, windowMs: 60_000 });
    if (!allowed) return errorResponse(429, "RATE_LIMITED", "Too many submissions. Please pause for a moment.");
    try {
      return json({ submission: await submit(env.DB, { participantId, text }) }, 201);
    } catch (error) {
      if (error.code === "EXERCISE_FINALIZED") return errorResponse(423, error.code, "The facilitator finalized this exercise, so new submissions are locked.");
      throw error;
    }
  }

  if (relativePath === "/api/auth" && request.method === "GET") {
    const session = await getSession(request, env);
    return json({ authenticated: Boolean(session), role: session?.role || null, expiresAt: session?.exp || null });
  }

  if (relativePath === "/api/auth" && request.method === "POST") {
    if (!sameOrigin(request)) return errorResponse(403, "ORIGIN_MISMATCH", "This action must come from the OutreachTalk site.");
    const missing = checkConfiguration(env, ["MODERATOR_PASSCODE", "SESSION_SECRET"]);
    if (missing.length) return errorResponse(503, "CONFIGURATION_ERROR", `Missing Worker secret: ${missing.join(", ")}.`);
    const subjectHash = await hashSubject(clientAddress(request), env.SESSION_SECRET);
    const allowed = await allowRate(env.DB, { subjectHash, action: "auth", limit: 10, windowMs: 15 * 60_000 });
    if (!allowed) return errorResponse(429, "RATE_LIMITED", "Too many passcode attempts. Try again later.");
    const body = await readJson(request);
    const requestedRole = body.role === "facilitator" ? "facilitator" : "moderator";
    const expected = requestedRole === "facilitator"
      ? (env.FACILITATOR_PASSCODE || env.MODERATOR_PASSCODE)
      : env.MODERATOR_PASSCODE;
    if (!await safeEqualStrings(body.passcode || "", expected || "")) {
      return errorResponse(401, "INVALID_PASSCODE", "That passcode is not correct.");
    }
    const exp = Date.now() + COOKIE_TTL_MS;
    const token = await signSession({ role: requestedRole, exp, nonce: crypto.randomUUID() }, env.SESSION_SECRET);
    return json(
      { authenticated: true, role: requestedRole, expiresAt: exp },
      200,
      { "Set-Cookie": sessionCookie({ token, basePath, maxAgeSeconds: COOKIE_TTL_MS / 1000 }) }
    );
  }

  if (relativePath === "/api/auth" && request.method === "DELETE") {
    if (!sameOrigin(request)) return errorResponse(403, "ORIGIN_MISMATCH", "This action must come from the OutreachTalk site.");
    return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie({ basePath }) });
  }

  if (request.method === "GET" && relativePath === "/api/moderator/submissions") {
    if (!await requireRole(request, env, ["moderator"])) return errorResponse(401, "AUTH_REQUIRED", "Enter the moderator passcode to continue.");
    return json(await moderatorSnapshot(env.DB));
  }

  const moderationMatch = relativePath.match(/^\/api\/moderator\/submissions\/([a-f0-9-]+)$/i);
  if (request.method === "PATCH" && moderationMatch) {
    if (!sameOrigin(request)) return errorResponse(403, "ORIGIN_MISMATCH", "This action must come from the OutreachTalk site.");
    if (!await requireRole(request, env, ["moderator"])) return errorResponse(401, "AUTH_REQUIRED", "Enter the moderator passcode to continue.");
    const body = await readJson(request);
    if (!["approved", "rejected"].includes(body.status)) return errorResponse(400, "INVALID_STATUS", "Status must be approved or rejected.");
    try {
      return json({ submission: await setStatus(env.DB, moderationMatch[1], body.status) });
    } catch (error) {
      if (error.code === "NOT_FOUND") return errorResponse(404, error.code, error.message);
      throw error;
    }
  }

  if (request.method === "POST" && relativePath === "/api/exercise/finalize") {
    if (!sameOrigin(request)) return errorResponse(403, "ORIGIN_MISMATCH", "This action must come from the OutreachTalk site.");
    if (!await requireRole(request, env, ["facilitator", "moderator"])) return errorResponse(401, "AUTH_REQUIRED", "Enter a staff passcode to continue.");
    return json({ exercise: await setFinalized(env.DB, true) });
  }

  if (request.method === "POST" && relativePath === "/api/exercise/reopen") {
    if (!sameOrigin(request)) return errorResponse(403, "ORIGIN_MISMATCH", "This action must come from the OutreachTalk site.");
    if (!await requireRole(request, env, ["facilitator", "moderator"])) return errorResponse(401, "AUTH_REQUIRED", "Enter a staff passcode to continue.");
    return json({ exercise: await setFinalized(env.DB, false) });
  }

  if (request.method === "POST" && relativePath === "/api/exercise/reset") {
    if (!sameOrigin(request)) return errorResponse(403, "ORIGIN_MISMATCH", "This action must come from the OutreachTalk site.");
    if (!await requireRole(request, env, ["facilitator", "moderator"])) return errorResponse(401, "AUTH_REQUIRED", "Enter a staff passcode to continue.");
    const body = await readJson(request);
    if (body.confirm !== "RESET") return errorResponse(400, "CONFIRMATION_REQUIRED", "Type RESET to clear the exercise.");
    return json({ state: await resetExercise(env.DB) });
  }

  return errorResponse(404, "NOT_FOUND", "API route not found.");
}

function assetPathFor(relativePath) {
  const clean = relativePath.replace(/\/+$/, "") || "/";
  if (clean === "/") return "/index.html";
  if (clean === "/play") return "/play/index.html";
  if (clean === "/moderator") return "/moderator/index.html";
  if (clean === "/lab") return "/lab/index.html";
  return relativePath;
}

async function serveAsset(request, env, relativePath) {
  if (!["GET", "HEAD"].includes(request.method)) return errorResponse(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPathFor(relativePath);
  const assetRequest = new Request(assetUrl, request);
  const response = await env.ASSETS.fetch(assetRequest);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (headers.get("Content-Type")?.includes("text/html")) headers.set("Cache-Control", "no-cache");
  return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    try {
      if (!env.DB) return errorResponse(503, "CONFIGURATION_ERROR", "The D1 database binding named DB is missing.");
      const url = new URL(request.url);
      const basePath = normalizeBasePath(env.APP_BASE_PATH || "");
      const pathname = decodeURIComponent(url.pathname);

      if (basePath && pathname === "/") return Response.redirect(`${url.origin}${basePath}/`, 302);
      if (basePath && pathname === basePath) return Response.redirect(`${url.origin}${basePath}/`, 302);
      if (basePath && !pathname.startsWith(`${basePath}/`)) {
        return errorResponse(404, "NOT_FOUND", "Page not found.");
      }

      const relativePath = basePath ? (pathname.slice(basePath.length) || "/") : pathname;
      if (["/play", "/moderator", "/lab"].includes(relativePath) && ["GET", "HEAD"].includes(request.method)) {
        return Response.redirect(`${url.origin}${basePath}${relativePath}/`, 302);
      }
      if (relativePath.startsWith("/api/")) return await handleApi(request, env, relativePath, url, basePath);
      return await serveAsset(request, env, relativePath);
    } catch (error) {
      console.error(error);
      if (error.code === "PAYLOAD_TOO_LARGE") return errorResponse(413, error.code, error.message);
      if (error.code === "INVALID_JSON") return errorResponse(400, error.code, error.message);
      return errorResponse(500, "INTERNAL_ERROR", "The server could not complete that request.");
    }
  }
};

export { normalizeBasePath, assetPathFor };
