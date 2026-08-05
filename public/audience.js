"use strict";

const APP_BASE = location.pathname.replace(/\/+$/, "");
const API_BASE = `${APP_BASE}/api`;
const participantStorageKey = `outreach-participant:${APP_BASE || "/"}`;
const participantId = getParticipantId();

const textInput = document.getElementById("submissionText");
const submitButton = document.getElementById("submitButton");
const feedback = document.getElementById("submitFeedback");
const list = document.getElementById("submissionList");
const exerciseBadge = document.getElementById("exerciseBadge");
const finalizedNotice = document.getElementById("finalizedNotice");
const approvedCount = document.getElementById("approvedCount");
const characterCount = document.getElementById("characterCount");
let finalized = false;

function getParticipantId() {
  let id = localStorage.getItem(participantStorageKey);
  if (!id || !/^[a-zA-Z0-9_-]{8,80}$/.test(id)) {
    id = `p_${crypto.randomUUID().replace(/-/g, "")}`;
    localStorage.setItem(participantStorageKey, id);
  }
  return id;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function badge(status) {
  return `<span class="status-badge status-${status}">${status}</span>`;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "The request could not be completed.");
  return payload;
}

function applyState(state) {
  finalized = Boolean(state.exercise?.finalized);
  exerciseBadge.textContent = finalized ? "Finalized" : "Open";
  exerciseBadge.className = `status-badge status-${finalized ? "finalized" : "open"}`;
  finalizedNotice.hidden = !finalized;
  textInput.disabled = finalized;
  submitButton.disabled = finalized;
  approvedCount.textContent = `${state.counts?.approved || 0} approved overall`;
}

function renderMine(submissions) {
  if (!submissions.length) {
    list.innerHTML = '<div class="empty-state">Nothing submitted from this browser yet.</div>';
    return;
  }
  list.innerHTML = submissions.map(item => `
    <article class="submission-item">
      <div class="submission-meta">
        ${badge(item.status)}
        <time datetime="${new Date(item.createdAt).toISOString()}">${new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
      </div>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join("");
}

async function refresh() {
  try {
    const [state, mine] = await Promise.all([
      api("/state", { headers: {} }),
      api(`/submissions/mine?participantId=${encodeURIComponent(participantId)}`, { headers: {} })
    ]);
    applyState(state);
    renderMine(mine.submissions || []);
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function submit() {
  const text = textInput.value.replace(/\s+/g, " ").trim();
  if (text.length < 4) {
    feedback.textContent = "Write at least four characters.";
    textInput.focus();
    return;
  }
  submitButton.disabled = true;
  feedback.textContent = "Sending…";
  try {
    await api("/submissions", {
      method: "POST",
      body: JSON.stringify({ participantId, text })
    });
    textInput.value = "";
    characterCount.textContent = "0 / 180";
    feedback.textContent = "Submitted as pending. A moderator will review it.";
    await refresh();
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    submitButton.disabled = finalized;
  }
}

textInput.addEventListener("input", () => {
  characterCount.textContent = `${textInput.value.length} / 180`;
  feedback.textContent = "";
});
submitButton.addEventListener("click", submit);
textInput.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit();
});

const events = new EventSource(`${API_BASE}/events`);
events.addEventListener("state", event => {
  try {
    applyState(JSON.parse(event.data));
    refresh();
  } catch { /* ignore malformed event */ }
});
events.onerror = () => { feedback.textContent = "Reconnecting to the live exercise…"; };

refresh();
