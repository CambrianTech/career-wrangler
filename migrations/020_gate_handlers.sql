-- 020_gate_handlers — which handler handles each gate type, per owner (slice 4).
-- The plan's "pluggable handlers, human by default; the opt-in is data, not code":
-- this table IS the opt-in. Code registers handlers under names in src/gates.js; an
-- owner row here selects one of them for a gate kind — or leaves it absent and the
-- gate stays with a person (the default). No handler name in a row that no code has
-- registered is refused at write time, so a typo can never silently unstaff a gate.
CREATE TABLE IF NOT EXISTS gate_handlers (
  owner_id   TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL CHECK (kind IN ('captcha','login','2fa','final_submit')), -- same set as gate_actions.kind
  handler    TEXT NOT NULL DEFAULT 'human',      -- 'human' or a name registered in src/gates.js
  updated_at INTEGER NOT NULL,                   -- epoch ms; the row is config, not history
  PRIMARY KEY (owner_id, kind)
);
