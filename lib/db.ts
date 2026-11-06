import { neon } from '@neondatabase/serverless';
import type { RecordItem } from './model';

type State = { revision: number; records: RecordItem[] };
const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;
let local: Promise<typeof import('./local-db')> | null = null;
let schema: Promise<void> | null = null;

function localDb() {
    if (process.env.NODE_ENV === 'production')
        throw new Error('DATABASE_URL must be configured for production deployments.');
    local ??= import('./local-db.ts');
    return local;
}

async function ensureSchema() {
    if (!sql)
        return;
    schema ??= (async () => {
        await sql`CREATE TABLE IF NOT EXISTS workboard_state (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, records JSONB NOT NULL)`;
        await sql`INSERT INTO workboard_state (id, revision, records) VALUES (1, 0, '[]'::jsonb) ON CONFLICT (id) DO NOTHING`;
        await sql`CREATE TABLE IF NOT EXISTS workboard_secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    })();
    await schema;
}

export async function readState(): Promise<State> {
    if (!sql)
        return (await localDb()).readLocalState();
    await ensureSchema();
    const rows = await sql`SELECT revision, records FROM workboard_state WHERE id = 1`;
    return { revision: Number(rows[0].revision), records: rows[0].records as RecordItem[] };
}

export async function writeState(revision: number, records: RecordItem[]): Promise<State | null> {
    if (!sql)
        return (await localDb()).writeLocalState(revision, records);
    await ensureSchema();
    const rows = await sql`
        UPDATE workboard_state
        SET revision = revision + 1, records = ${JSON.stringify(records)}::jsonb
        WHERE id = 1 AND revision = ${revision}
        RETURNING revision, records
    `;
    return rows.length ? { revision: Number(rows[0].revision), records: rows[0].records as RecordItem[] } : null;
}

export async function secret(key: string, value?: string): Promise<string | undefined> {
    if (!sql)
        return (await localDb()).localSecret(key, value);
    await ensureSchema();
    if (value !== undefined) {
        await sql`INSERT INTO workboard_secrets (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    }
    const rows = await sql`SELECT value FROM workboard_secrets WHERE key = ${key}`;
    return rows[0]?.value;
}
