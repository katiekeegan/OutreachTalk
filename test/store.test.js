"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { ExerciseStore } = require("../lib/store");

async function makeStore() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "outreach-store-"));
  const store = new ExerciseStore(path.join(directory, "state.json"));
  await store.init();
  return { store, directory };
}

test("new submissions start pending and approved items enter the public dataset", async t => {
  const { store, directory } = await makeStore();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const submission = await store.submit({ participantId: "participant_123", text: "Math can be surprising." });
  assert.equal(submission.status, "pending");
  assert.equal(store.publicSnapshot().approved.length, 0);

  await store.setStatus(submission.id, "approved");
  const publicState = store.publicSnapshot();
  assert.equal(publicState.approved.length, 1);
  assert.equal(publicState.approved[0].text, "Math can be surprising.");
  assert.equal(publicState.counts.approved, 1);
});

test("rejected submissions leave the pending queue but remain in moderator history", async t => {
  const { store, directory } = await makeStore();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const submission = await store.submit({ participantId: "participant_456", text: "A triangle has three sides." });
  await store.setStatus(submission.id, "rejected");
  const state = store.moderatorSnapshot();
  assert.equal(state.submissions[0].status, "rejected");
  assert.equal(state.submissions.filter(item => item.status === "pending").length, 0);
});

test("finalization locks new submissions while allowing moderation of the existing queue", async t => {
  const { store, directory } = await makeStore();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const queued = await store.submit({ participantId: "participant_789", text: "The museum is full of patterns." });
  await store.finalize();

  await assert.rejects(
    () => store.submit({ participantId: "participant_999", text: "The museum is open." }),
    error => error.code === "EXERCISE_FINALIZED"
  );

  await store.setStatus(queued.id, "approved");
  assert.equal(store.publicSnapshot().approved.length, 1);
});

test("a failed locked submission does not poison later state mutations", async t => {
  const { store, directory } = await makeStore();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  await store.finalize();
  await assert.rejects(() => store.submit({ participantId: "participant_abc", text: "Math can be playful." }));
  await store.reopen();
  const accepted = await store.submit({ participantId: "participant_abc", text: "Math can be playful." });
  assert.equal(accepted.status, "pending");
});
