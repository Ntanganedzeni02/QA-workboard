import { cookies } from 'next/headers';
import { secret } from '../../../lib/db';
import { authorized, safeOrigin } from '../../../lib/auth';
export const runtime = 'nodejs';
async function slack(method: string, args: Record<string, string> = {}) { const token = secret('slack_token'); if (!token)
    throw Error('Slack is disconnected'); const r = await fetch('https://slack.com/api/' + method + '?' + new URLSearchParams(args), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }); const data = await r.json(); if (!data.ok)
    throw Error(data.error || 'Slack request failed'); return data; }
export async function GET(req: Request) { if (!await authorized())
    return new Response('Unauthorized', { status: 401 }); const url = new URL(req.url); try {
    if (url.searchParams.has('connect')) {
        if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET || !process.env.APP_URL)
            throw Error('Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET and APP_URL on the server first');
        const state = crypto.randomUUID();
        (await cookies()).set('slack_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600, secure: process.env.COOKIE_SECURE === 'true' });
        return Response.redirect('https://slack.com/oauth/v2/authorize?' + new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID, scope: 'channels:read,channels:history,groups:read,groups:history,users:read', redirect_uri: process.env.APP_URL + '/api/slack', state }));
    }
    if (url.searchParams.has('code')) {
        const expected = (await cookies()).get('slack_state')?.value;
        if (!expected || expected !== url.searchParams.get('state'))
            throw Error('Invalid OAuth state');
        (await cookies()).delete('slack_state');
        const r = await fetch('https://slack.com/api/oauth.v2.access', { method: 'POST', body: new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID!, client_secret: process.env.SLACK_CLIENT_SECRET!, code: url.searchParams.get('code')!, redirect_uri: process.env.APP_URL + '/api/slack' }) });
        const d = await r.json();
        if (!d.ok)
            throw Error(d.error);
        secret('slack_token', d.access_token);
        return Response.redirect(process.env.APP_URL! + '/?slack=connected');
    }
    if (url.searchParams.has('channels')) {
        let cursor = '', channels: any[] = [];
        do {
            const d = await slack('conversations.list', { types: 'public_channel,private_channel', limit: '200', cursor, exclude_archived: 'true' });
            channels.push(...d.channels);
            cursor = d.response_metadata?.next_cursor || '';
        } while (cursor);
        return Response.json({ channels });
    }
    return Response.json({ connected: !!secret('slack_token'), lastSync: secret('slack_sync') || null });
}
catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
} }
export async function POST(req: Request) { if (!await authorized() || !safeOrigin(req))
    return new Response('Unauthorized', { status: 401 }); try {
    const { channel, from, to, disconnect } = await req.json();
    if (disconnect) {
        secret('slack_token', '');
        return Response.json({ ok: true });
    }
    if (!channel || !from || !to || from > to)
        throw Error('Choose a channel and valid date range');
    let cursor = '', messages: any[] = [];
    do {
        const d = await slack('conversations.history', { channel, oldest: String(Date.parse(from + 'T00:00:00+02:00') / 1000), latest: String(Date.parse(to + 'T23:59:59+02:00') / 1000), limit: '100', cursor });
        messages.push(...d.messages);
        cursor = d.response_metadata?.next_cursor || '';
    } while (cursor);
    const authors = new Map();
    for (const m of messages) {
        if (m.user && !authors.has(m.user)) {
            const u = await slack('users.info', { user: m.user });
            authors.set(m.user, u.user.real_name || u.user.name);
        }
        m.sender = authors.get(m.user) || m.username || m.user || 'Unknown';
        m.permalink = (await slack('chat.getPermalink', { conversation_id: channel, message_ts: m.ts })).permalink;
        if (m.thread_ts || m.reply_count) {
            try {
                let threadCursor = '', thread: any[] = [];
                do {
                    const t = await slack('conversations.replies', { channel, ts: m.thread_ts || m.ts, limit: '100', cursor: threadCursor });
                    thread.push(...t.messages);
                    threadCursor = t.response_metadata?.next_cursor || '';
                } while (threadCursor);
                m.thread = thread.map((t: any) => `${t.user || t.username || 'Unknown'} [${t.ts}]: ${t.text}`).join('\n');
            }
            catch (e: any) {
                m.thread = 'Thread unavailable: ' + e.message;
            }
        }
    }
    const sync = new Date().toISOString();
    secret('slack_sync', sync);
    return Response.json({ messages, lastSync: sync });
}
catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
} }
