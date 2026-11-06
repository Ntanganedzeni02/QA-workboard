import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
export function session() { return createHmac('sha256', process.env.APP_PASSWORD || 'local').update('paaq-personal-session').digest('hex'); }
export function same(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export async function authorized() { if (!process.env.APP_PASSWORD)
    return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_NO_AUTH === 'true'; return same((await cookies()).get('paaq_session')?.value || '', session()); }
export function safeOrigin(req: Request) { const origin = req.headers.get('origin'); if (!origin)
    return true; try {
    const parsed = new URL(origin);
    return origin === process.env.APP_URL || (parsed.host === req.headers.get('host') && parsed.protocol === new URL(req.url).protocol);
}
catch {
    return false;
} }
