-- 001_blobs — the content-addressed blob store (docs/data-model.md → Conventions).
-- Every *_ref column in the schema points here. Keyed per owner: one row per
-- (owner_id, sha256), so two owners sharing one file get two rows and deletion
-- and privacy stay exact (invariant 6). Bytes are stored, not reconstructed.

CREATE TABLE IF NOT EXISTS blobs (
  id          TEXT PRIMARY KEY,                          -- uuid
  owner_id    TEXT NOT NULL REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  sha256      TEXT NOT NULL,                             -- hex digest of the bytes
  bytes       BLOB NOT NULL,
  created_at  INTEGER NOT NULL                           -- epoch ms (timestamptz mapping)
);

-- "Keyed per owner" lookup order:
CREATE UNIQUE INDEX IF NOT EXISTS uq_blobs_owner_sha ON blobs(owner_id, sha256);
-- AND the reference-target order children's composite FKs use,
-- e.g. packages(cover_letter_ref, owner_id) -> blobs(sha256, owner_id):
CREATE UNIQUE INDEX IF NOT EXISTS idx_blobs_sha_owner ON blobs(sha256, owner_id);
