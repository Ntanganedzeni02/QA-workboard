import { readState, writeState } from '../../../lib/db';
import { authorized, safeOrigin } from '../../../lib/auth';
export const runtime = 'nodejs';
export async function GET() { if (!await authorized())
    return new Response('Sign in required. Set APP_PASSWORD on the server.', { status: 401 }); return Response.json(await readState(), { headers: { 'Cache-Control': 'no-store' } }); }
export async function PUT(req: Request) { if (!await authorized() || !safeOrigin(req))
    return new Response('Unauthorized', { status: 401 }); const data = await req.json(); if (!Array.isArray(data.records) || data.records.length > 50000 || !data.records.every((r: any) => r && typeof r.id === 'string' && typeof r.kind === 'string' && typeof r.title === 'string') || new Set(data.records.map((r: any) => r.id)).size !== data.records.length)
    return new Response('Invalid records', { status: 400 }); const saved = await writeState(data.revision, data.records); return saved ? Response.json(saved) : new Response('Another tab saved changes. Reload before saving to avoid overwriting them.', { status: 409 }); }
