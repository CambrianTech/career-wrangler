-- 005_resume_sources — the one source of truth per user (docs/data-model.md → resume_sources).
CREATE TABLE IF NOT EXISTS resume_sources (
  id        TEXT PRIMARY KEY,                          -- uuid
  owner_id  TEXT NOT NULL REFERENCES users(id),
  doc_key   TEXT NOT NULL,                             -- e.g. 'resume-source'
  revision  INTEGER NOT NULL DEFAULT 1,
  sha256    TEXT NOT NULL,
  updated_at INTEGER NOT NULL,                         -- epoch ms
  created_at INTEGER NOT NULL                          -- epoch ms
);

-- One active row per (owner, doc_key) per revision; superseded rows stay for lineage:
CREATE UNIQUE INDEX IF NOT EXISTS uq_resume_sources ON resume_sources(owner_id, doc_key, revision);
