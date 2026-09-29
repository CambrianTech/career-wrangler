-- 006_flavors — versioned role resumes derived from the source (docs/data-model.md → flavors).
-- A source change regenerates flavors as NEW revisions; old ones stay, so a package
-- can always name what it was built from (invariant 8: lineage over mutation).
CREATE TABLE IF NOT EXISTS flavors (
  id           TEXT PRIMARY KEY,                          -- uuid
  owner_id     TEXT NOT NULL REFERENCES users(id),
  doc_key      TEXT NOT NULL,                             -- e.g. 'resume-ai-architect'
  revision     INTEGER NOT NULL DEFAULT 1,
  derived_from TEXT NOT NULL REFERENCES resume_sources(id), -- the source row it was built from
  status       TEXT NOT NULL CHECK (status IN ('active','retired')),
  created_at   INTEGER NOT NULL                           -- epoch ms
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_flavors ON flavors(owner_id, doc_key, revision);
