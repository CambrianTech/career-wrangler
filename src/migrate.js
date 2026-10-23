// src/migrate.js — one migration file per data-model table, applied in name order.
//
// The migration_log row and the CREATE TABLE commit together (or not at all),
// so a re-run is idempotent and a half-applied state never exists: each file
// runs inside its own transaction with PRAGMA foreign_keys live for the whole
// session (see src/db.js).

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { openDb, fkPragmaOn } from './db.js';

// fileURLToPath (not new URL(import.meta.url).pathname): the pathname form is
// '/C:/...' on Windows and win32 path functions mangle it into C:\C:\...
const HERE = path.dirname(fileURLToPath(import.meta.url)); // .../src
export const MIGRATIONS_DIR = path.join(HERE, '..', 'migrations');

// migrationsDir is a testability seam (default: the repo's migrations/): the old-base
// upgrade test builds a pre-018 base through this same migrator, pointed at a copy of the
// shipped files minus 018. Product behaviour is unchanged when the argument is omitted.
export function applyMigrations(db, migrationsDir = MIGRATIONS_DIR) {
  if (!fkPragmaOn(db)) {
    throw new Error('refusing to migrate: PRAGMA foreign_keys must be ON (see src/db.js)');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS migration_log (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`);

  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const done = new Set(db.prepare('SELECT name FROM migration_log').all().map((r) => r.name));
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
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
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.env.DATABASE_URL || path.join(HERE, '..', 'data', 'career.sqlite');
  const db = openDb(file);
  const { applied, total } = applyMigrations(db);
  console.log(`migrations: ${applied} applied, ${total} present (${file})`);
  db.close();
}
