-- 010_gate_actions — the queue the website puts front and center (docs/data-model.md → gate_actions).
CREATE TABLE IF NOT EXISTS gate_actions (
  id               TEXT PRIMARY KEY,                       -- uuid
  owner_id         TEXT NOT NULL REFERENCES users(id),
  submission_id    TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('captcha','login','2fa','final_submit')),
  ask              TEXT NOT NULL,                          -- the single precise thing to do
  opened_at        INTEGER NOT NULL,                       -- epoch ms
  closed_at        INTEGER,                                -- epoch ms, nullable
  closed_by        TEXT REFERENCES users(id),              -- nullable
  verification_ref TEXT,                                   -- → blobs, nullable
  FOREIGN KEY (submission_id, owner_id) REFERENCES submissions(id, owner_id),
  FOREIGN KEY (verification_ref, owner_id) REFERENCES blobs(sha256, owner_id)
);

-- Invariant 1: at most one OPEN gate per submission. Closed gates stay in history;
-- only the open ones are bounded by this partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gate_actions_open ON gate_actions(submission_id) WHERE closed_at IS NULL;
