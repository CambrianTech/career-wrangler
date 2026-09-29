// src/db.js — one connection per process, PRAGMA foreign_keys ON at the door.
//
// SQLite turns off foreign-key enforcement by default on EVERY new connection;
// `PRAGMA foreign_keys` is a no-op inside a transaction. We therefore open each
// connection with it ON before any DDL or DML (docs/data-model.md invariant 6
// depends on this — the cross-owner package rejection only throws when the
// pragma is live), and we refuse to run migrations without it.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function openDb(file) {
  if (file !== ':memory:') {
    const dir = path.dirname(path.resolve(file));
    mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(file);
  // Must be set outside a transaction and before any other statement.
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

// `StatementSync#get()` returns the row as a JS OBJECT keyed by column name —
// `{ foreign_keys: 1 }` here — so read the value out of it. (Number(row) throws
// "Cannot convert object to primitive value"; this guard is what migrate.js's
// precondition relies on, and it has to actually work.)
export function fkPragmaOn(db) {
  const row = db.prepare('PRAGMA foreign_keys;').get();
  return Number(Object.values(row ?? {})[0]) === 1;
}
