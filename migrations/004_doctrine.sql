-- 004_doctrine — standing rules set once by an owner (docs/data-model.md → doctrine).
CREATE TABLE IF NOT EXISTS doctrine (
  id        TEXT PRIMARY KEY,                          -- uuid
  owner_id  TEXT NOT NULL REFERENCES users(id),
  targets   TEXT NOT NULL CHECK (json_valid(targets)),-- structured list, not prose (jsonb)
  tone      TEXT NOT NULL,
  salary_stance TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(salary_stance)), -- jsonb
  revision  INTEGER NOT NULL DEFAULT 1,               -- bumped on each save; a job says which it ran under
  created_at INTEGER NOT NULL,                         -- epoch ms
  UNIQUE (owner_id)                                   -- one standing document per owner
);
