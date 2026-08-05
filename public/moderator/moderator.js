"use strict";

const APP_BASE = location.pathname.replace(/\/moderator\/?$/, "");
const API_BASE = `${APP_BASE}/api`;
const loginScreen = document.getElementById("loginScreen");
const queueScreen = document.getElementById("queueScreen");
const passcode = document.getElementById("passcode");
const loginFeedback = document.getElementById("loginFeedback");
const logoutButton = document.getElementById("logoutButton");
const pendingList = document.getElementById("pendingList");
const historyList = document.getElementById("historyList");
const exerciseBadge = document.getElementById("exerciseBadge");
let authenticated = false;
let refreshInFlight = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function showLogin(message = "") {
  authenticated = false;
  loginScreen.hidden = false;
  queueScreen.hidden = true;
  logoutButton.hidden = true;
  loginFeedback.textContent = message;
  window.setTimeout(() => passcode.focus(), 50);
}

function showQueue() {
  authenticated = true;
  loginScreen.hidden = true;
  queueScreen.hidden = false;
  logoutButton.hidden = false;
}

function badge(status) {
  return `<span class="status-badge status-${status}">${status}</span>`;
}

function render(data) {
  const pending = data.submissions.filter(item => item.status === "pending");
  const decided = data.submissions.filter(item => item.status !== "pending").slice(0, 30);
  document.getElementById("pendingMetric").textContent = pending.length;
  document.getElementById("approvedMetric").textContent = data.submissions.filter(item => item.status === "approved").length;
  document.getElementById("rejectedMetric").textContent = data.submissions.filter(item => item.status === "rejected").length;

  const finalized = Boolean(data.exercise.finalized);
  exerciseBadge.textContent = finalized ? "Finalized" : "Open";
  exerciseBadge.className = `status-badge status-${finalized ? "finalized" : "open"}`;

  pendingList.innerHTML = pending.length ? pending.map(item => `
    <article class="moderation-item" data-id="${item.id}">
      <div class="split">
        ${badge("pending")}
        <time class="timestamp" datetime="${new Date(item.createdAt).toISOString()}">${new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
      </div>
      <p>${escapeHtml(item.text)}</p>
      <div class="moderation-actions">
        <button class="danger-button" type="button" data-action="rejected">Reject</button>
        <button class="primary" type="button" data-action="approved">Approve</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state">No pending submissions.</div>';

  historyList.innerHTML = decided.length ? decided.map(item => `
    <article class="moderation-item">
      <div class="split">
        ${badge(item.status)}
        <time class="timestamp" datetime="${new Date(item.updatedAt).toISOString()}">${new Date(item.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
      </div>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join("") : '<div class="empty-state">No decisions yet.</div>';
}

async function refresh() {
  if (!authenticated || refreshInFlight) return;
  refreshInFlight = true;
  try {
    render(await api("/moderator/submissions", { headers: {} }));
  } catch (error) {
    if (error.status === 401) return showLogin("Your moderator session expired.");
    pendingList.innerHTML = `<div class="notice notice-danger">${escapeHtml(error.message)}</div>`;
  } finally {
    refreshInFlight = false;
  }
}

async function login() {
  loginFeedback.textContent = "Checking…";
  try {
    await api("/auth", {
      method: "POST",
      body: JSON.stringify({ role: "moderator", passcode: passcode.value })
    });
    passcode.value = "";
    showQueue();
    await refresh();
  } catch (error) {
    loginFeedback.textContent = error.message;
  }
}

async function moderate(id, status, button) {
  const item = button.closest(".moderation-item");
  item.querySelectorAll("button").forEach(control => { control.disabled = true; });
  try {
    await api(`/moderator/submissions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await refresh();
  } catch (error) {
    item.querySelectorAll("button").forEach(control => { control.disabled = false; });
    window.alert(error.message);
  }
}

document.getElementById("loginButton").addEventListener("click", login);
passcode.addEventListener("keydown", event => { if (event.key === "Enter") login(); });
document.getElementById("refreshButton").addEventListener("click", refresh);
pendingList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  const item = button?.closest("[data-id]");
  if (button && item) moderate(item.dataset.id, button.dataset.action, button);
});
logoutButton.addEventListener("click", async () => {
  await api("/auth", { method: "DELETE", body: "{}" }).catch(() => null);
  showLogin("Logged out.");
});

const refreshTimer = window.setInterval(refresh, 2000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
window.addEventListener("focus", refresh);
window.addEventListener("pagehide", () => window.clearInterval(refreshTimer), { once: true });

api("/auth", { headers: {} })
  .then(status => {
    if (status.authenticated && status.role === "moderator") {
      showQueue();
      refresh();
    } else showLogin();
  })
  .catch(() => showLogin("Could not check the staff session."));
