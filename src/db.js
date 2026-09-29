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

export function fkPragmaOn(db) {
  return Number(db.prepare('PRAGMA foreign_keys;').get()) === 1;
}
