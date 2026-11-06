import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
export const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'workboard.sqlite'));
db.exec('PRAGMA busy_timeout=5000');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, records TEXT NOT NULL); INSERT OR IGNORE INTO state VALUES(1,0,\'[]\'); CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
export function readState() { const r = db.prepare('SELECT * FROM state WHERE id=1').get() as any; return { revision: r.revision, records: JSON.parse(r.records) }; }
export function writeState(revision: number, records: unknown[]) { const r = db.prepare('UPDATE state SET revision=revision+1,records=? WHERE id=1 AND revision=?').run(JSON.stringify(records), revision); return Number(r.changes) ? readState() : null; }
export function secret(key: string, value?: string) { if (value !== undefined)
    db.prepare('INSERT OR REPLACE INTO secrets VALUES(?,?)').run(key, value); return (db.prepare('SELECT value FROM secrets WHERE key=?').get(key) as any)?.value; }
