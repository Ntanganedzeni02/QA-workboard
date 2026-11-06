import { session, same, safeOrigin } from '../../../lib/auth';
export async function POST(req: Request) { if (!safeOrigin(req))
    return new Response('Invalid origin', { status: 403 }); const { password } = await req.json(); if (!process.env.APP_PASSWORD || !same(password || '', process.env.APP_PASSWORD))
    return new Response('Incorrect password', { status: 401 }); return Response.json({ ok: true }, { headers: { 'Set-Cookie': `paaq_session=${session()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}` } }); }
