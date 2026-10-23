-- 007_postings — roles found by the scanning jobs (docs/data-model.md → postings).
CREATE TABLE IF NOT EXISTS postings (
  id         TEXT PRIMARY KEY,                            -- uuid
  owner_id   TEXT NOT NULL REFERENCES users(id),
  url        TEXT NOT NULL,                               -- normalized before store: scheme lowered, trailing slash and tracking params stripped
  title      TEXT NOT NULL,
  company    TEXT NOT NULL,
  destination TEXT NOT NULL CHECK (destination IN ('board','ats')),
  found_at   INTEGER NOT NULL,                            -- epoch ms
  created_at INTEGER NOT NULL                             -- epoch ms
);

-- Unique per owner AFTER normalization: the same posting is never tracked twice for one owner.
CREATE UNIQUE INDEX IF NOT EXISTS uq_postings ON postings(owner_id, url);
