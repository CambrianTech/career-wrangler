-- 011_contacts — people the owner talks to, optionally tied to a submission
-- (docs/data-model.md → contacts). submission_id is nullable: a contact can
-- exist before any submission; SQLite's MATCH SIMPLE semantics do not check a
-- composite child key containing NULL, so ownership is enforced only when set.
CREATE TABLE IF NOT EXISTS contacts (
  id            TEXT PRIMARY KEY,                       -- uuid
  owner_id      TEXT NOT NULL REFERENCES users(id),
  submission_id TEXT,                                   -- nullable → submissions
  name          TEXT NOT NULL,
  email         TEXT,
  title         TEXT,
  notes         TEXT,
  FOREIGN KEY (submission_id, owner_id) REFERENCES submissions(id, owner_id)
);
