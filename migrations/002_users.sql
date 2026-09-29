-- 002_users — accounts for both layers (docs/data-model.md → users).
CREATE TABLE IF NOT EXISTS users (
  id        TEXT PRIMARY KEY,                          -- uuid
  name      TEXT NOT NULL,
  email     TEXT,                                      -- nullable; unique among humans below
  kind      TEXT NOT NULL CHECK (kind IN ('human','citizen')),
  peer_id   TEXT,                                      -- Continuum peer id when kind = citizen
  created_at INTEGER NOT NULL                          -- epoch ms (timestamptz mapping)
);

-- A partial unique index covers the humans:
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_human ON users(email) WHERE kind = 'human';
-- Citizens authenticate by peer_id, which is unique when set:
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_peer ON users(peer_id) WHERE peer_id IS NOT NULL;
