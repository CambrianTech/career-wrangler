-- 015_job_runs — the scheduler's memory: what ran when, and whether a missed
-- window was already caught up (docs/data-model.md → job_runs). A lapsed lease
-- lets another runner take over the same window instead of wedging it
-- (invariant 5); the unique key lives in the table itself, enforced by the
-- database — downtime produces one make-up run per missed window, never twice.
CREATE TABLE IF NOT EXISTS job_runs (
  id               TEXT PRIMARY KEY,                     -- uuid
  job_key          TEXT NOT NULL,                        -- 'scan.postings', 'followups.due', ...
  due_ms           INTEGER NOT NULL,                     -- bigint: the window boundary
  started_at       INTEGER NOT NULL,                     -- epoch ms
  finished_at      INTEGER,                              -- epoch ms, nullable
  status           TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
  lease_owner      TEXT REFERENCES users(id),            -- nullable; a lapsed lease is takeable
  lease_expires_at INTEGER,                              -- epoch ms, nullable
  request_id       TEXT REFERENCES action_log(id)        -- the act that started it
);

-- Invariant 5: exactly one run per (job_key, due_ms). "Latest wins" is
-- impossible at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_runs_window ON job_runs(job_key, due_ms);
