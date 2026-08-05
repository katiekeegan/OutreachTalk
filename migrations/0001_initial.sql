CREATE TABLE IF NOT EXISTS exercise_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  finalized INTEGER NOT NULL DEFAULT 0 CHECK (finalized IN (0, 1)),
  finalized_at INTEGER,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO exercise_state (id, finalized, finalized_at, updated_at)
VALUES (1, 0, NULL, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 4 AND 180),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS submissions_participant_created
  ON submissions (participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_status_created
  ON submissions (status, created_at ASC);

CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_lookup
  ON rate_limits (subject_hash, action, occurred_at);

CREATE TRIGGER IF NOT EXISTS submissions_after_insert
AFTER INSERT ON submissions
BEGIN
  UPDATE exercise_state SET updated_at = NEW.updated_at WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS submissions_after_status_update
AFTER UPDATE OF status ON submissions
BEGIN
  UPDATE exercise_state SET updated_at = NEW.updated_at WHERE id = 1;
END;
