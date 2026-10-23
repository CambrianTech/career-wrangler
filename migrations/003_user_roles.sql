-- 003_user_roles — one row per (user, owner) pair (docs/data-model.md → user_roles).
CREATE TABLE IF NOT EXISTS user_roles (
  id        TEXT PRIMARY KEY,                          -- uuid
  user_id   TEXT NOT NULL REFERENCES users(id),
  owner_id  TEXT NOT NULL REFERENCES users(id),        -- the account whose doctrine this is
  role      TEXT NOT NULL CHECK (role IN ('owner','collaborator')),
  created_at INTEGER NOT NULL,                         -- epoch ms
  UNIQUE (user_id, owner_id)                           -- one row per pair
);
