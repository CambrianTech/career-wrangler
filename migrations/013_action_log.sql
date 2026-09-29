-- 013_action_log — intent before, outcome after: every effectful act of any
-- actor, human or citizen, through the API (docs/data-model.md → action_log).
CREATE TABLE IF NOT EXISTS action_log (
  id          TEXT PRIMARY KEY,                         -- uuid
  actor       TEXT NOT NULL REFERENCES users(id),
  request_id  TEXT NOT NULL,                            -- caller-chosen per-intent idempotency key
  verb        TEXT NOT NULL,                            -- submission.approve, gate.complete, ...
  target      TEXT NOT NULL CHECK (json_valid(target)), -- jsonb: kind + id
  intent_at   INTEGER NOT NULL,                         -- epoch ms
  outcome_at  INTEGER,                                  -- epoch ms, nullable
  outcome     TEXT NOT NULL DEFAULT 'in_flight'
              CHECK (outcome IN ('in_flight','ok','error')),
  error_ref   TEXT,                                     -- → blobs, nullable
  UNIQUE (actor, request_id)                            -- invariant 2: no user's key shadows another's
);
