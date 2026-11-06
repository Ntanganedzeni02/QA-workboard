import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';
import type { RecordItem } from './model';

type State = { revision: number; records: RecordItem[] };
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 5 }) : null;
if (pool && process.env.VERCEL)
    attachDatabasePool(pool);
let local: Promise<typeof import('./local-db')> | null = null;
let schema: Promise<void> | null = null;

function localDb() {
    if (process.env.NODE_ENV === 'production')
        throw new Error('DATABASE_URL must be configured for production deployments.');
    local ??= import('./local-db.ts');
    return local;
}

async function ensureSchema() {
    if (!pool)
        return;
    schema ??= (async () => {
        await pool.query('CREATE TABLE IF NOT EXISTS workboard_state (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, records JSONB NOT NULL)');
        await pool.query("INSERT INTO workboard_state (id, revision, records) VALUES (1, 0, '[]'::jsonb) ON CONFLICT (id) DO NOTHING");
        await pool.query('CREATE TABLE IF NOT EXISTS workboard_secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    })();
    await schema;
}

export async function readState(): Promise<State> {
    if (!pool)
        return (await localDb()).readLocalState();
    await ensureSchema();
    const result = await pool.query<{ revision: number; records: RecordItem[] }>('SELECT revision, records FROM workboard_state WHERE id = 1');
    const row = result.rows[0];
    if (!row)
        throw new Error('Neon database is missing the workboard state row.');
    return { revision: Number(row.revision), records: row.records };
}

export async function writeState(revision: number, records: RecordItem[]): Promise<State | null> {
    if (!pool)
        return (await localDb()).writeLocalState(revision, records);
    await ensureSchema();
    const result = await pool.query<{ revision: number; records: RecordItem[] }>(`
        UPDATE workboard_state
        SET revision = revision + 1, records = $1::jsonb
        WHERE id = 1 AND revision = $2
        RETURNING revision, records
    `, [JSON.stringify(records), revision]);
    const row = result.rows[0];
    return row ? { revision: Number(row.revision), records: row.records } : null;
}

export async function secret(key: string, value?: string): Promise<string | undefined> {
    if (!pool)
        return (await localDb()).localSecret(key, value);
    await ensureSchema();
    if (value !== undefined) {
        await pool.query('INSERT INTO workboard_secrets (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value]);
    }
    const result = await pool.query<{ value: string }>('SELECT value FROM workboard_secrets WHERE key = $1', [key]);
    return result.rows[0]?.value;
}
