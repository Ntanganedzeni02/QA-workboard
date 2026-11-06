import { authorized, safeOrigin } from '../../../lib/auth';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { get } from '@vercel/blob';
export const runtime = 'nodejs';
const usesBlob = Boolean(process.env.VERCEL);
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');

export async function POST(req: Request) {
    if (!await authorized() || !safeOrigin(req))
        return new Response('Unauthorized', { status: 401 });
    if (usesBlob)
        return new Response('Use the private Blob direct-upload endpoint.', { status: 400 });
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size > 20 * 1024 * 1024)
        return new Response('Choose a file under 20 MB', { status: 400 });
    const id = crypto.randomUUID();
    await mkdir(path.join(dataDir, 'evidence'), { recursive: true });
    await writeFile(path.join(dataDir, 'evidence', id), Buffer.from(await file.arrayBuffer()));
    return Response.json({ id, name: file.name, size: file.size });
}

export async function GET(req: Request) {
    if (!await authorized())
        return new Response('Unauthorized', { status: 401 });
    const url = new URL(req.url);
    if (url.searchParams.has('config'))
        return Response.json({ directUpload: usesBlob });
    const id = url.searchParams.get('id') || '';
    if (!/^[a-f0-9-]{36}$/.test(id))
        return new Response('Invalid file', { status: 400 });
    if (usesBlob) {
        const blob = await get(`evidence/${id}`, { access: 'private' });
        if (!blob || blob.statusCode !== 200)
            return new Response('File not found', { status: 404 });
        return new Response(blob.stream, { headers: { 'Content-Type': blob.blob.contentType || 'application/octet-stream', 'Content-Disposition': 'attachment; filename="evidence"', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
    }
    try {
        return new Response(await readFile(path.join(dataDir, 'evidence', id)), { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="evidence"', 'X-Content-Type-Options': 'nosniff' } });
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return new Response('File not found', { status: 404 });
        throw error;
    }
}
