export const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS exercise_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    finalized INTEGER NOT NULL DEFAULT 0 CHECK (finalized IN (0, 1)),
    finalized_at INTEGER,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL,
    text TEXT NOT NULL CHECK (length(text) BETWEEN 4 AND 180),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS submissions_participant_created
    ON submissions (participant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS submissions_status_created
    ON submissions (status, created_at ASC)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_hash TEXT NOT NULL,
    action TEXT NOT NULL,
    occurred_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS rate_limits_lookup
    ON rate_limits (subject_hash, action, occurred_at)`
];

let schemaPromise;

async function initializeSchema(db) {
  // Run each DDL statement independently. This avoids D1 parsing edge cases
  // around large multi-statement exec() calls and trigger bodies.
  for (const statement of SCHEMA_STATEMENTS) {
    await db.prepare(statement).run();
  }
  await db.prepare(`
    INSERT OR IGNORE INTO exercise_state (id, finalized, finalized_at, updated_at)
    VALUES (1, 0, NULL, ?)
  `).bind(Date.now()).run();
}

export function ensureSchema(db) {
  if (!schemaPromise) {
    schemaPromise = initializeSchema(db).catch(error => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

function exerciseFromRow(row) {
  return {
    finalized: Boolean(row?.finalized),
    finalizedAt: row?.finalized_at ?? null,
    updatedAt: row?.updated_at ?? Date.now()
  };
}

function submissionFromRow(row, includeParticipant = false) {
  const item = {
    id: row.id,
    text: row.text,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (includeParticipant) item.participantId = row.participant_id;
  return item;
}

export async function publicSnapshot(db) {
  await ensureSchema(db);
  const [exerciseResult, approvedResult, countsResult] = await db.batch([
    db.prepare("SELECT finalized, finalized_at, updated_at FROM exercise_state WHERE id = 1"),
    db.prepare("SELECT id, text, status, created_at, updated_at FROM submissions WHERE status = 'approved' ORDER BY created_at ASC"),
    db.prepare("SELECT status, COUNT(*) AS count FROM submissions GROUP BY status")
  ]);
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const row of countsResult.results || []) counts[row.status] = Number(row.count) || 0;
  const exercise = exerciseFromRow(exerciseResult.results?.[0]);
  return {
    exercise,
    approved: (approvedResult.results || []).map(row => submissionFromRow(row)),
    counts,
    updatedAt: exercise.updatedAt
  };
}

export async function mine(db, participantId) {
  await ensureSchema(db);
  const result = await db.prepare(
    "SELECT id, text, status, created_at, updated_at FROM submissions WHERE participant_id = ? ORDER BY created_at DESC LIMIT 50"
  ).bind(participantId).all();
  return (result.results || []).map(row => submissionFromRow(row));
}

export async function moderatorSnapshot(db) {
  await ensureSchema(db);
  const [exerciseResult, submissionsResult] = await db.batch([
    db.prepare("SELECT finalized, finalized_at, updated_at FROM exercise_state WHERE id = 1"),
    db.prepare("SELECT id, participant_id, text, status, created_at, updated_at FROM submissions ORDER BY created_at DESC LIMIT 500")
  ]);
  return {
    exercise: exerciseFromRow(exerciseResult.results?.[0]),
    submissions: (submissionsResult.results || []).map(row => submissionFromRow(row, true))
  };
}

export async function submit(db, { participantId, text }) {
  await ensureSchema(db);
  const now = Date.now();
  const id = crypto.randomUUID();
  const row = await db.prepare(`
    INSERT INTO submissions (id, participant_id, text, status, created_at, updated_at)
    SELECT ?, ?, ?, 'pending', ?, ?
    WHERE (SELECT finalized FROM exercise_state WHERE id = 1) = 0
    RETURNING id, text, status, created_at, updated_at
  `).bind(id, participantId, text, now, now).first();
  if (!row) {
    const error = new Error("The exercise is finalized.");
    error.code = "EXERCISE_FINALIZED";
    throw error;
  }
  await db.prepare("UPDATE exercise_state SET updated_at = ? WHERE id = 1").bind(now).run();
  return submissionFromRow(row);
}

export async function setStatus(db, id, status) {
  if (!VALID_STATUSES.has(status) || status === "pending") throw new Error("Invalid moderation status.");
  await ensureSchema(db);
  const now = Date.now();
  const row = await db.prepare(`
    UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?
    RETURNING id, participant_id, text, status, created_at, updated_at
  `).bind(status, now, id).first();
  if (!row) {
    const error = new Error("Submission not found.");
    error.code = "NOT_FOUND";
    throw error;
  }
  await db.prepare("UPDATE exercise_state SET updated_at = ? WHERE id = 1").bind(now).run();
  return submissionFromRow(row, true);
}

export async function setFinalized(db, finalized) {
  await ensureSchema(db);
  const now = Date.now();
  const row = await db.prepare(`
    UPDATE exercise_state
    SET finalized = ?, finalized_at = ?, updated_at = ?
    WHERE id = 1
    RETURNING finalized, finalized_at, updated_at
  `).bind(finalized ? 1 : 0, finalized ? now : null, now).first();
  return exerciseFromRow(row);
}

export async function resetExercise(db) {
  await ensureSchema(db);
  const now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM submissions"),
    db.prepare("DELETE FROM rate_limits"),
    db.prepare("UPDATE exercise_state SET finalized = 0, finalized_at = NULL, updated_at = ? WHERE id = 1").bind(now)
  ]);
  return publicSnapshot(db);
}

export async function allowRate(db, { subjectHash, action, limit, windowMs }) {
  await ensureSchema(db);
  const now = Date.now();
  const cutoff = now - windowMs;
  const count = await db.prepare(
    "SELECT COUNT(*) AS count FROM rate_limits WHERE subject_hash = ? AND action = ? AND occurred_at >= ?"
  ).bind(subjectHash, action, cutoff).first("count");
  if (Number(count) >= limit) return false;
  await db.prepare("INSERT INTO rate_limits (subject_hash, action, occurred_at) VALUES (?, ?, ?)")
    .bind(subjectHash, action, now).run();
  if (Math.random() < 0.02) {
    await db.prepare("DELETE FROM rate_limits WHERE occurred_at < ?").bind(now - 24 * 60 * 60 * 1000).run();
  }
  return true;
}
