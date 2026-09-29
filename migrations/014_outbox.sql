-- 014_outbox — durable messages to airc, written in the SAME TRANSACTION as the
-- state change they announce (docs/data-model.md → outbox). The dispatcher
-- drains at-least-once; receivers dedupe on (actor, request_id) (invariants 2/4).
CREATE TABLE IF NOT EXISTS outbox (
  id             TEXT PRIMARY KEY,                      -- uuid
  seq            INTEGER NOT NULL,                      -- bigint per destination
  destination    TEXT NOT NULL,                         -- airc room / peer / topic
  request_id     TEXT NOT NULL REFERENCES action_log(id),
  payload        TEXT NOT NULL CHECK (json_valid(payload)), -- jsonb
  created_at     INTEGER NOT NULL,                      -- epoch ms
  dispatched_at  INTEGER                                -- epoch ms, nullable
);

-- seq is a per-destination message line: one number per destination.
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_dest_seq ON outbox(destination, seq);
