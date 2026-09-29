-- 012_followups — scheduled touches on a submission (thank-you note, nudge
-- after N days) (docs/data-model.md → followups). Due rows are picked up by the
-- job runner; a missed window runs once on recovery via job_runs, never twice.
CREATE TABLE IF NOT EXISTS followups (
  id            TEXT PRIMARY KEY,                       -- uuid
  owner_id      TEXT NOT NULL REFERENCES users(id),
  submission_id TEXT NOT NULL,
  due_at        INTEGER NOT NULL,                       -- epoch ms
  kind          TEXT NOT NULL,
  done_at       INTEGER,                                -- epoch ms, nullable
  FOREIGN KEY (submission_id, owner_id) REFERENCES submissions(id, owner_id)
);
