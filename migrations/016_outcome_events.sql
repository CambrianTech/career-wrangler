-- 016_outcome_events — delayed, confounded signals from the world
-- (docs/data-model.md → outcome_events). Ownership rides down through the
-- submission FK; cohort reports compare comparable postings across these rows
-- and read only consented outcome_events.
CREATE TABLE IF NOT EXISTS outcome_events (
  id            TEXT PRIMARY KEY,                        -- uuid
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  kind          TEXT NOT NULL CHECK (kind IN ('response','no_response_after_n_days','interview_call','offer','rejection')),
  at            INTEGER NOT NULL,                        -- epoch ms
  source_ref    TEXT,                                    -- → blobs sha256, nullable; app enforces owner scope (the contract carries no owner column here)
  consented     INTEGER NOT NULL DEFAULT 0 CHECK (consented IN (0,1))
);
