-- 008_submissions — the tracked unit end-to-end (docs/data-model.md → submissions).
CREATE TABLE IF NOT EXISTS submissions (
  id           TEXT PRIMARY KEY,                          -- uuid
  owner_id     TEXT NOT NULL REFERENCES users(id),
  posting_id   TEXT NOT NULL REFERENCES postings(id),
  status       TEXT NOT NULL CHECK (status IN ('found','package_ready','waiting_on_human','submitted','responded','interview','offer','closed')),
  whose_turn   TEXT NOT NULL CHECK (whose_turn IN ('persona','human')),
  approved_by  TEXT REFERENCES users(id),                -- nullable
  approved_at  INTEGER,                                   -- epoch ms, nullable
  submitted_at INTEGER,                                   -- epoch ms, nullable
  evidence_ref TEXT,                                      -- → blobs, nullable
  created_at   INTEGER NOT NULL,                          -- epoch ms
  -- invariant 7: state 'submitted' requires approved_by set — no row announces an
  -- external send that nobody approved.
  CHECK (status <> 'submitted' OR approved_by IS NOT NULL),
  FOREIGN KEY (evidence_ref, owner_id) REFERENCES blobs(sha256, owner_id)
);

-- The pair (id, owner_id) is the reference target of the composite foreign keys
-- packages / gate_actions / contacts / followups use to ride ownership down from
-- here (invariant 6). id alone being a PK does not cover that key set.
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_id_owner ON submissions(id, owner_id);
