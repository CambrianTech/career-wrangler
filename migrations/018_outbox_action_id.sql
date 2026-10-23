-- 018_outbox_action_id — forward rename of the outbox key column (request_id -> action_id).

-- The in-place edit to 014 at 5184f85 broke pre-existing databases: migrate.js
-- skips already-applied files by name, so a base DB that applied 014 keeps the
-- request_id column while src/outbox.js inserts action_id — every act() fails.
-- A forward migration is uniform for old and fresh bases; no conditional DDL.

-- SQLite RENAME COLUMN (3.25+) rewrites the REFERENCES clause in place, so rows,
-- uq_outbox_dest_seq, and the FK into action_log(id) all survive the rename
-- (node:sqlite here runs 3.53.0).

ALTER TABLE outbox RENAME COLUMN request_id TO action_id;
