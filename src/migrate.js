// src/migrate.js — one migration file per data-model table, applied in name order.
//
// The migration_log row and the CREATE TABLE commit together (or not at all),
// so a re-run is idempotent and a half-applied state never exists: each file
// runs inside its own transaction with PRAGMA foreign_keys live for the whole
// session (see src/db.js).

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { openDb, fkPragmaOn } from './db.js';

export const MIGRATIONS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'migrations');

export function applyMigrations(db) {
  if (!fkPragmaOn(db)) {
    throw new Error('refusing to migrate: PRAGMA foreign_keys must be ON (see src/db.js)');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS migration_log (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`);

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const done = new Set(db.prepare('SELECT name FROM migration_log').all().map((r) => r.name));
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO migration_log (name, applied_at) VALUES (?, ?)').run(file, Date.now());
      db.exec('COMMIT');
      applied += 1;
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`migration ${file} failed: ${err.message}`);
    }
  }
  return { applied, total: files.length };
}

// `npm run migrate` — applies to the DB at $DATABASE_URL or data/career.sqlite.
if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const file = process.env.DATABASE_URL || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'career.sqlite');
  const db = openDb(file);
  const { applied, total } = applyMigrations(db);
  console.log(`migrations: ${applied} applied, ${total} present (${file})`);
  db.close();
}
