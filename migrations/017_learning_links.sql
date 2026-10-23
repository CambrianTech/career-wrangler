-- 017_learning_links — the join for cohort analysis: which package version and
-- adapter produced a submission (docs/data-model.md → learning_links). One row
-- per submission; unseen episodes are reserved before any synthesis.
CREATE TABLE IF NOT EXISTS learning_links (
  id                     TEXT PRIMARY KEY,               -- uuid
  submission_id          TEXT NOT NULL UNIQUE REFERENCES submissions(id),
  adapter_version        TEXT NOT NULL,
  reserved_for_synthesis INTEGER NOT NULL DEFAULT 0 CHECK (reserved_for_synthesis IN (0,1))
);
