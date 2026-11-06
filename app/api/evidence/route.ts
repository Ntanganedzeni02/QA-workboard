import { authorized, safeOrigin } from '../../../lib/auth';
import { dataDir } from '../../../lib/db';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
export const runtime = 'nodejs';
export async function POST(req: Request) { if (!await authorized() || !safeOrigin(req))
    return new Response('Unauthorized', { status: 401 }); const form = await req.formData(); const file = form.get('file'); if (!(file instanceof File) || file.size > 20 * 1024 * 1024)
    return new Response('Choose a file under 20 MB', { status: 400 }); const id = crypto.randomUUID(); await mkdir(path.join(dataDir, 'evidence'), { recursive: true }); await writeFile(path.join(dataDir, 'evidence', id), Buffer.from(await file.arrayBuffer())); return Response.json({ id, name: file.name, size: file.size }); }
export async function GET(req: Request) { if (!await authorized())
    return new Response('Unauthorized', { status: 401 }); const id = new URL(req.url).searchParams.get('id') || ''; if (!/^[a-f0-9-]{36}$/.test(id))
    return new Response('Invalid file', { status: 400 }); try {
    return new Response(await readFile(path.join(dataDir, 'evidence', id)), { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="evidence"', 'X-Content-Type-Options': 'nosniff' } });
}
catch {
    return new Response('File not found', { status: 404 });
} }
