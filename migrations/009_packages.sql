-- 009_packages — the exact thing sent; never reconstructed from memory.
-- One row per attempt; a retry is a NEW row (docs/data-model.md → packages).
CREATE TABLE IF NOT EXISTS packages (
  id              TEXT PRIMARY KEY,                       -- uuid
  owner_id        TEXT NOT NULL REFERENCES users(id),
  submission_id   TEXT NOT NULL,
  flavor_refs     TEXT NOT NULL CHECK (json_valid(flavor_refs)), -- jsonb: doc_key + revision used
  cover_letter_ref TEXT,                                  -- → blobs, nullable
  form_answers    TEXT CHECK (form_answers IS NULL OR json_valid(form_answers)), -- jsonb, nullable
  sha256          TEXT NOT NULL,                          -- of the exact bytes sent
  created_at      INTEGER NOT NULL,                       -- epoch ms
  -- Ownership rides down by referential integrity (invariant 6): a package for
  -- owner B against owner A's submission is rejected at insert. There is NO
  -- unique on (submission_id, owner_id) — one row per attempt; retries are rows.
  FOREIGN KEY (submission_id, owner_id) REFERENCES submissions(id, owner_id),
  FOREIGN KEY (cover_letter_ref, owner_id) REFERENCES blobs(sha256, owner_id)
);
