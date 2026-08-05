"use strict";

const LIVE_APP_BASE = location.pathname.replace(/\/play\/?$/, "");
const LIVE_API_BASE = `${LIVE_APP_BASE}/api`;
const liveExerciseBadge = document.getElementById("liveExerciseBadge");
const topExerciseBadge = document.getElementById("exerciseStatusBadge");
const finalizedBanner = document.getElementById("finalizedBanner");
const approvedDatasetList = document.getElementById("approvedDatasetList");
const useApprovedDataset = document.getElementById("useApprovedDataset");
const authButton = document.getElementById("facilitatorAuthButton");
const authPanel = document.getElementById("facilitatorAuthPanel");
const passcodeInput = document.getElementById("facilitatorPasscode");
const loginButton = document.getElementById("facilitatorLoginButton");
const authFeedback = document.getElementById("facilitatorAuthFeedback");
const finalizeButton = document.getElementById("finalizeExerciseButton");
const reopenButton = document.getElementById("reopenExerciseButton");
const resetButton = document.getElementById("resetExerciseButton");
let liveState = { exercise: { finalized: false }, approved: [], counts: { pending: 0, approved: 0, rejected: 0 } };
let staffRole = null;

function escapeLiveHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

async function liveApi(path, options = {}) {
  const response = await fetch(`${LIVE_API_BASE}${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "The live exercise request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function renderLiveState(state) {
  liveState = state;
  const finalized = Boolean(state.exercise?.finalized);
  const statusText = finalized ? "Finalized" : "Open";
  liveExerciseBadge.textContent = statusText;
  liveExerciseBadge.className = `live-status ${finalized ? "finalized" : "open"}`;
  topExerciseBadge.textContent = finalized ? "Exercise finalized" : "Exercise open";
  topExerciseBadge.className = `exercise-status-badge ${finalized ? "exercise-finalized" : "exercise-open"}`;
  finalizedBanner.hidden = !finalized;

  document.getElementById("livePendingCount").textContent = state.counts?.pending || 0;
  document.getElementById("liveApprovedCount").textContent = state.counts?.approved || 0;
  document.getElementById("liveRejectedCount").textContent = state.counts?.rejected || 0;

  approvedDatasetList.innerHTML = state.approved?.length
    ? state.approved.map(item => `<div class="approved-example">${escapeLiveHtml(item.text)}</div>`).join("")
    : '<div class="approved-empty">No approved examples yet. The moderator queue controls what appears here.</div>';
  useApprovedDataset.disabled = !(state.approved?.length);

  const staff = Boolean(staffRole);
  finalizeButton.hidden = !staff || finalized;
  reopenButton.hidden = !staff || !finalized;
  resetButton.hidden = !staff;
}

async function refreshLiveState() {
  try {
    renderLiveState(await liveApi("/state", { headers: {} }));
  } catch (error) {
    approvedDatasetList.innerHTML = `<div class="approved-empty">${escapeLiveHtml(error.message)}</div>`;
  }
}

function setStaffRole(role) {
  staffRole = role;
  authButton.textContent = role ? `Staff signed in · ${role}` : "Staff sign in";
  authPanel.hidden = Boolean(role);
  renderLiveState(liveState);
}

async function checkStaffSession() {
  try {
    const status = await liveApi("/auth", { headers: {} });
    setStaffRole(status.authenticated ? status.role : null);
  } catch {
    setStaffRole(null);
  }
}

async function facilitatorLogin() {
  authFeedback.textContent = "Checking…";
  try {
    const result = await liveApi("/auth", {
      method: "POST",
      body: JSON.stringify({ role: "facilitator", passcode: passcodeInput.value })
    });
    passcodeInput.value = "";
    authFeedback.textContent = "Controls unlocked.";
    setStaffRole(result.role);
  } catch (error) {
    authFeedback.textContent = error.message;
  }
}

async function finalizeExercise() {
  const pending = liveState.counts?.pending || 0;
  const warning = pending
    ? `${pending} submission${pending === 1 ? " is" : "s are"} still pending. Finalizing blocks new submissions but moderators can continue reviewing the existing queue. Continue?`
    : "Finalize the exercise and block all new audience submissions?";
  if (!window.confirm(warning)) return;
  finalizeButton.disabled = true;
  try {
    const result = await liveApi("/exercise/finalize", { method: "POST", body: "{}" });
    renderLiveState({ ...liveState, exercise: result.exercise });
  } catch (error) {
    window.alert(error.message);
  } finally {
    finalizeButton.disabled = false;
  }
}

async function reopenExercise() {
  if (!window.confirm("Reopen audience submissions?")) return;
  reopenButton.disabled = true;
  try {
    const result = await liveApi("/exercise/reopen", { method: "POST", body: "{}" });
    renderLiveState({ ...liveState, exercise: result.exercise });
  } catch (error) {
    window.alert(error.message);
  } finally {
    reopenButton.disabled = false;
  }
}

async function resetExercise() {
  const confirmation = window.prompt("This clears every submission. Type RESET to continue.");
  if (confirmation !== "RESET") return;
  resetButton.disabled = true;
  try {
    await liveApi("/exercise/reset", { method: "POST", body: JSON.stringify({ confirm: "RESET" }) });
    await refreshLiveState();
  } catch (error) {
    window.alert(error.message);
  } finally {
    resetButton.disabled = false;
  }
}

function loadApprovedIntoModel() {
  const examples = liveState.approved?.map(item => item.text).filter(Boolean) || [];
  if (!examples.length) return;
  const trainingData = document.getElementById("trainingData");
  trainingData.value = examples.join("\n");
  document.getElementById("trainButton").click();
  trainingData.scrollIntoView({ block: "center", behavior: "smooth" });
}

authButton.addEventListener("click", () => {
  authPanel.hidden = !authPanel.hidden;
  if (!authPanel.hidden) window.setTimeout(() => passcodeInput.focus(), 50);
});
loginButton.addEventListener("click", facilitatorLogin);
passcodeInput.addEventListener("keydown", event => { if (event.key === "Enter") facilitatorLogin(); });
finalizeButton.addEventListener("click", finalizeExercise);
reopenButton.addEventListener("click", reopenExercise);
resetButton.addEventListener("click", resetExercise);
useApprovedDataset.addEventListener("click", loadApprovedIntoModel);

const liveEvents = new EventSource(`${LIVE_API_BASE}/events`);
liveEvents.addEventListener("state", event => {
  try { renderLiveState(JSON.parse(event.data)); } catch { /* ignore malformed event */ }
});

refreshLiveState();
checkStaffSession();
