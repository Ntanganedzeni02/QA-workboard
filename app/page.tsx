'use client';
import { useEffect, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { products, statuses, checkStatuses, results, platforms, fresh, applyTemplate, outstanding, attention, recordResult, report, defect, type RecordItem as Item, type State } from '../lib/model';
const pages = ['Today', 'Workboard', 'Release Testing', 'Defects & Retests', 'Settings'];
const icons = ['◷', '▦', '☑', '⚑', '⚙'];
const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function download(name: string, body: string, type = 'application/json') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
export default function App() {
    const [state, setState] = useState<State>({ revision: 0, records: [] });
    const [loaded, setLoaded] = useState(false);
    const [auth, setAuth] = useState(false);
    const [password, setPassword] = useState('');
    const [page, setPage] = useState('Today');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('All');
    const [product, setProduct] = useState('All');
    const [platform, setPlatform] = useState('All');
    const [feature, setFeature] = useState('All');
    const [sort, setSort] = useState('Newest');
    const [board, setBoard] = useState(true);
    const [releaseId, setReleaseId] = useState('');
    const [draft, setDraft] = useState<Item | null>(null);
    const [saveState, setSaveState] = useState('Loading');
    const [pending, setPending] = useState<Item[] | null>(null);
    const [error, setError] = useState('');
    const [trash, setTrash] = useState(false);
    const [reportText, setReportText] = useState('');
    const [from, setFrom] = useState(localDate().slice(0, 8) + '01');
    const [to, setTo] = useState(localDate());
    const [slack, setSlack] = useState<any>({ connected: false });
    const [channels, setChannels] = useState<any[]>([]);
    const [channel, setChannel] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [notice, setNotice] = useState('');
    const [menu, setMenu] = useState(false);
    async function load() { try {
        const r = await fetch('/api/store');
        if (r.status === 401) {
            setAuth(true);
            return;
        }
        if (!r.ok)
            throw Error(await r.text());
        setState(await r.json());
        setLoaded(true);
        setAuth(false);
        setSaveState('Saved');
        setPending(null);
        setError('');
    }
    catch (e: any) {
        setError(e.message);
        setSaveState('Failed');
    } }
    useEffect(() => { load(); fetch('/api/slack').then(r => r.json()).then(setSlack).catch(() => { }); }, []);
    async function save(records: Item[]) { if (!loaded)
        return false; setSaveState('Saving'); setPending(records); setError(''); try {
        const r = await fetch('/api/store', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: state.revision, records }) });
        if (!r.ok)
            throw Error(await r.text());
        setState(await r.json());
        setSaveState('Saved');
        setPending(null);
        return true;
    }
    catch (e: any) {
        setError(e.message);
        setSaveState('Failed');
        return false;
    } }
    const live = state.records.filter(r => !r.deleted), tasks = live.filter(r => r.kind === 'task'), releases = live.filter(r => r.kind === 'release'), checks = live.filter(r => r.kind === 'check'), messages = live.filter(r => r.kind === 'message'), templates = live.filter(r => r.kind === 'template');
    const release = releases.find(r => r.id === releaseId);
    const currentChecks = checks.filter(r => r.releaseId === releaseId);
    const attentionItems = attention(state.records, localDate());
    function nav(p: string, f = 'All') { setPage(p); setFilter(f); setSearch(''); setProduct('All'); setPlatform('All'); setFeature('All'); setTrash(false); setMenu(false); }
    function open(r: Item) { setDraft(structuredClone(r)); }
    async function put(r: Item) { r = { ...r, activity: [...(r.activity || []), new Date().toISOString()] }; return save(state.records.some(a => a.id === r.id) ? state.records.map(a => a.id === r.id ? r : a) : [...state.records, r]); }
    async function change(r: Item, patch: Partial<Item>) { return await put({ ...r, ...patch, updatedAt: new Date().toISOString() }); }
    async function commit() { if (!draft)
        return; if (!draft.title.trim()) {
        setError('Add a title to save.');
        return;
    } if (draft.kind === 'release' && !draft.product) {
        setError('Choose a product.');
        return;
    } const original = state.records.find(r => r.id === draft.id); const next = draft.kind === 'check' && draft.result !== 'Not Recorded' ? recordResult(original || fresh('check', { id: draft.id }), draft) : { ...draft, updatedAt: new Date().toISOString() }; if (await put(next)) {
        setDraft(null);
        setError('');
    } }
    async function remove(r: Item) { if (confirm(`Move “${r.title}” to recently deleted? You can restore it in Settings.`)) {
        if (await change(r, { deleted: true }))
            setDraft(null);
    } }
    function select(items: Item[]) { return items.filter(r => (!trash || r.deleted) && r.title.toLowerCase().includes(search.toLowerCase()) && (product === 'All' || (r.product || releases.find(a => a.id === r.releaseId)?.product) === product) && (platform === 'All' || r.platform === platform) && (feature === 'All' || r.feature === feature) && (filter === 'All' || r.status === filter || r.result === filter || (filter === 'Priority' && r.priority === 'High' && r.status !== 'Done') || (filter === 'Blockers' && r.blocker && r.status !== 'Done'))).sort((a, b) => sort === 'Title' ? a.title.localeCompare(b.title) : sort === 'Priority' ? ['High', 'Normal', 'Low'].indexOf(a.priority) - ['High', 'Normal', 'Low'].indexOf(b.priority) : sort === 'Due date' ? (a.due || '9999').localeCompare(b.due || '9999') : b.updatedAt.localeCompare(a.updatedAt)); }
    function newRecord(kind: string) { setDraft(fresh(kind, kind === 'check' ? { releaseId, platform: platform === 'All' ? 'Web' : platform } : kind === 'message' ? { status: 'Needs response', date: localDate() } : kind === 'meeting' ? { recurrence: 'Weekly', day: 'Monday' } : kind === 'template' ? { checks: [] } : {})); setError(''); }
    function next(r: Item) { return r.nextStep || (r.status === 'Retesting' ? 'Retest check' : r.kind === 'message' ? 'Review message' : r.result === 'Fail' ? 'Review defect' : ''); }
    function row(r: Item) { return <button className="record" key={r.id} onClick={() => open(r)}><div className="record-icon">{r.kind === 'message' ? '▤' : r.kind === 'check' ? '✓' : '□'}</div><div className="grow"><strong>{r.title}</strong>{next(r) && <p>{next(r)}</p>}{r.blocker && <p className="danger">Blocker: {r.blocker}</p>}</div><span className={'badge ' + (r.result === 'Fail' ? 'red' : r.result === 'Pass' ? 'green' : '')}>{r.kind === 'check' ? r.result : r.status}</span><span className="muted">↗</span></button>; }
    function tools(items: Item[], isCheck = false) { return <div className="filters"><input aria-label="Search records" placeholder="Search by title…" value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="Status or result" value={filter} onChange={e => setFilter(e.target.value)}>{['All', ...(isCheck ? checkStatuses : statuses), ...(isCheck ? results : []), 'Priority', 'Blockers'].map(s => <option key={s}>{s}</option>)}</select><select aria-label="Product filter" value={product} onChange={e => setProduct(e.target.value)}>{['All', ...products].map(s => <option key={s}>{s}</option>)}</select>{isCheck && <select aria-label="Feature filter" value={feature} onChange={e => setFeature(e.target.value)}>{['All', ...new Set(items.map(r => r.feature).filter(Boolean))].map(s => <option key={s}>{s}</option>)}</select>}<select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)}>{['Newest', 'Title', 'Priority', 'Due date'].map(s => <option key={s}>{s}</option>)}</select><span className="muted">{select(items).length} items</span></div>; }
    function empty(text: string, action?: () => void, label = 'Add') { return <div className="empty"><span>{text}</span>{action && <button onClick={action}>{label}</button>}</div>; }
    function fields(names: [
        string,
        string,
        string?
    ][], r: Item = draft!) { return names.map(([key, label, type]) => <label key={key}>{label}{type === 'textarea' ? <textarea value={r[key] || ''} onChange={e => setDraft({ ...r, [key]: e.target.value })}/> : <input type={type || 'text'} value={r[key] || ''} onChange={e => setDraft({ ...r, [key]: e.target.value })}/>}</label>); }
    function dropdown(key: string, label: string, options: string[], optional = false) { return <label>{label}<select aria-label={label} value={draft?.[key] || ''} onChange={e => setDraft({ ...draft!, [key]: e.target.value, ...(key === 'recurrence' && e.target.value === 'First Monday' ? { day: 'Monday' } : {}) })}>{optional && <option value="">Not set</option>}{options.map(s => <option key={s}>{s}</option>)}</select></label>; }
    async function copy(text: string) { try {
        await navigator.clipboard.writeText(text);
        setNotice('Copied to clipboard');
    }
    catch {
        setNotice('Clipboard unavailable. Select and copy the text manually.');
    } }
    function csv() { const cols = ['title', 'feature', 'platform', 'status', 'result', 'priority', 'severity', 'expected', 'actual', 'blocker', 'nextStep']; download('paaq-checks.csv', [cols.join(','), ...currentChecks.map(r => cols.map(k => '"' + String(r[k] || '').replaceAll('"', '""') + '"').join(','))].join('\r\n'), 'text/csv'); }
    function meetingDate(m: Item) { const next = upcoming(m); const [date,time] = next.split(' · '); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return next; return new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',timeZone:'Africa/Johannesburg'}).format(new Date(date+'T12:00:00+02:00'))+' · '+time; }
    const defaultMeetings = [{ id: 'default-mon', title: 'Monday meeting', day: 'Monday', time: '12:30', recurrence: 'Weekly' }, { id: 'default-tue', title: 'Tuesday meeting', day: 'Tuesday', time: '10:00', recurrence: 'Weekly' }, { id: 'default-first', title: 'Monthly meeting', day: 'Monday', time: '', recurrence: 'First Monday' }].map(m => ({ ...fresh('meeting', m), ...m }));
    const meetings = [...defaultMeetings.filter(m => !state.records.some(r => r.id === m.id)), ...live.filter(r => r.kind === 'meeting')];
    function upcoming(m: Item) { const start = localDate(); for (let i = 0; i < 40; i++) {
        const date = new Date(start + 'T00:00:00+02:00');
        date.setUTCDate(date.getUTCDate() + i);
        const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Africa/Johannesburg' }).format(date);
        const dayOfMonth = Number(new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'Africa/Johannesburg' }).format(date));
        if (day === m.day && (m.recurrence !== 'First Monday' || dayOfMonth <= 7)) {
            const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
            if (m.time && new Date(iso + 'T' + m.time + ':00+02:00') < new Date())
                continue;
            return `${iso} · ${m.time || 'Time not set'}`;
        }
    } return 'Time not set'; }
    if (auth)
        return <main className="login panel"><div className="brand">P<span>AAQ</span></div><h1>Workboard</h1><p>Enter your dashboard password.</p><form onSubmit={async (e) => { e.preventDefault(); const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); if (r.ok)
            load();
        else
            setError(await r.text()); }}><input type="password" aria-label="Password" value={password} onChange={e => setPassword(e.target.value)}/><button className="primary">Sign in</button></form>{error && <p className="danger">{error}</p>}</main>;
    return <div className="shell"><aside className={menu ? 'sidebar visible' : 'sidebar'}><div className="brand">P<span>AAQ</span><small>WORKBOARD</small></div><div className="personal"><span className="avatar">N</span><div>My workboard</div></div><nav>{pages.map((p, i) => <button key={p} aria-label={p} className={page === p ? 'active' : ''} onClick={() => nav(p)}><span>{icons[i]}</span>{p}</button>)}</nav></aside><main><header className="topbar"><button className="mobile" aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>☰</button><span>My workboard <span className="muted">/ {page}</span></span><div className="top-right"><span className={'save ' + (saveState === 'Failed' ? 'danger' : '')}>{saveState === 'Saved' ? '✓ ' : ''}{saveState}</span><span className="avatar small">N</span></div></header><div className="content">{error && <div role="alert" className="error">{error} {pending && <button disabled={saveState === 'Saving'} onClick={() => save(pending)}>Retry save</button>}<button onClick={() => { if (!pending || confirm('Discard the unsaved change and load the latest records?'))
        load(); }}>Reload latest</button></div>}{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}<div className="page-heading"><div className="heading-title"><h1>{page}</h1>{page === 'Today' && <time title="Africa/Johannesburg" dateTime={localDate()}>{new Intl.DateTimeFormat('en-ZA', { weekday:'short',day:'numeric',month:'short',timeZone:'Africa/Johannesburg' }).format(new Date())}</time>}</div><div className="actions">{page === 'Today' || page === 'Workboard' ? <button className="primary" onClick={() => newRecord('task')}>＋ New task</button> : page === 'Release Testing' ? <button className="primary" onClick={() => newRecord('release')}>＋ New release</button> : null}</div></div>
    {page === 'Today' && <>
      <div className="stats" aria-label="Work counts">{[['Priority tasks', tasks.filter(r => r.priority === 'High' && r.status !== 'Done').length, 'Workboard', 'Priority'], ['In progress', tasks.filter(r => r.status === 'In Progress').length, 'Workboard', 'In Progress'], ['Pending retests', checks.filter(r => r.status === 'Retesting').length, 'Defects & Retests', 'Retesting']].map(([label,count,p,f]) => <button className="stat" key={label} onClick={() => nav(String(p),String(f))}><strong>{count}</strong><span>{label}</span></button>)}</div>
      <div className="dashboard-grid">
        <section className="panel"><div className="section-head"><h2>Today’s tasks</h2><button onClick={() => nav('Workboard')}>Workboard →</button></div>{tasks.filter(r => r.status !== 'Done').sort((a,b) => ['High','Normal','Low'].indexOf(a.priority)-['High','Normal','Low'].indexOf(b.priority)).slice(0,5).map(row)}{!tasks.some(r => r.status !== 'Done') && empty('No tasks',()=>newRecord('task'))}</section>
        <section className="panel"><div className="section-head"><h2>Testing & retesting</h2><button onClick={() => nav('Release Testing')}>Releases →</button></div>{checks.filter(r => r.status !== 'Done' || r.result !== 'Pass').slice(0,5).map(row)}{!checks.some(r => r.status !== 'Done' || r.result !== 'Pass') && empty('No pending checks',()=>nav('Release Testing'),'Open releases')}</section>
        <section className="panel"><div className="section-head"><h2>Blockers & follow-ups</h2></div>{attentionItems.slice(0,5).map(row)}{!attentionItems.length && empty('No follow-ups')}</section>
        <section className="panel"><div className="section-head"><h2>Upcoming meetings</h2><button onClick={() => nav('Settings')}>Edit →</button></div>{meetings.sort((a,b)=>upcoming(a).localeCompare(upcoming(b))).map(m=><button className="meeting" key={m.id} title={m.recurrence+' · Africa/Johannesburg'} onClick={()=>open(m)}><strong>{m.title}</strong><span>{meetingDate(m)}</span></button>)}{!meetings.length && empty('No meetings',()=>newRecord('meeting'))}</section>
      </div>
    </>}
    {page === 'Workboard' && <>{tools(tasks)}<div className="view-tabs"><button className={board ? 'selected' : ''} onClick={() => setBoard(true)}>▦ Board</button><button className={!board ? 'selected' : ''} onClick={() => setBoard(false)}>☷ List</button></div>{board ? <div className="board">{statuses.map(s => <section className="column" key={s} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const r = tasks.find(r => r.id === e.dataTransfer.getData('text/plain')); if (r)
        change(r, { status: s }); }}><h3><i />{s}<span>{select(tasks).filter(r => r.status === s).length}</span></h3>{select(tasks).filter(r => r.status === s).map(r => <article className="card" key={r.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', r.id)}><button className="card-open" onClick={() => open(r)}><span className={'priority ' + r.priority?.toLowerCase()}>{r.priority}</span><h3>{r.title}</h3>{r.nextStep && <p>{r.nextStep}</p>}{r.blocker && <p className="danger">⚑ {r.blocker}</p>}<small>{r.product || 'Product not set'} {r.due && '· ' + r.due}</small></button><select aria-label={'Status of ' + r.title} value={r.status} onChange={e => change(r, { status: e.target.value })}>{statuses.map(s => <option key={s}>{s}</option>)}</select></article>)}<button className="add-card" onClick={() => setDraft(fresh('task', { status: s }))}>＋ Add task</button></section>)}</div> : <section className="panel">{select(tasks).map(row)}{!select(tasks).length && empty('No tasks')}</section>}</>}
    {page === 'Release Testing' && <>{!release ? <div className="release-grid">{releases.map(r => { const c = checks.filter(x => x.releaseId === r.id); return <button className="panel release-card" key={r.id} onClick={() => { setReleaseId(r.id); setFilter('All'); }}><span className="badge">{r.product}</span><h2>{r.title}</h2>{r.scope && <p>{r.scope}</p>}<div className="progress"><i style={{ width: (c.length ? c.filter(x => x.result === 'Pass').length / c.length * 100 : 0) + '%' }}/></div><div className="spread"><span>{c.length} checks · {c.filter(x => x.result === 'Pass').length} passed</span><span>{c.length ? outstanding(c).length + ' outstanding' : 'Not tested'}</span></div></button>; })}{!releases.length && <section className="panel">{empty('No releases')}</section>}</div> : <><button onClick={() => setReleaseId('')}>← All releases</button><section className="panel release-overview"><div className="spread"><div><span className="badge">{release.product}</span><h2>{release.title}</h2><p>{[release.environment, release.build].filter(Boolean).join(' · ') || 'Environment and build not set'}</p></div><div className="actions"><button onClick={() => open(release)}>Edit release</button><button onClick={csv}>Export CSV</button><button className="primary" onClick={() => newRecord('check')}>＋ Add check</button></div></div><p className="hint">{currentChecks.length === 0 ? 'Not tested' : outstanding(currentChecks).length ? `${outstanding(currentChecks).length} outstanding checks` : 'All checks passed and completed'} · {currentChecks.filter(c => c.result === 'Fail').length} failures · {currentChecks.filter(c => c.blocker || c.result === 'Blocked').length} blocked · {currentChecks.filter(c => c.result === 'Not Recorded').length} untested · {currentChecks.filter(c => c.status === 'Retesting').length} pending retests</p><div className="actions"><select aria-label="Apply template" defaultValue="" onChange={e => { const t = templates.find(t => t.id === e.target.value); if (t)
        save([...state.records, ...applyTemplate(t, release.id)]); e.target.value = ''; }}><option value="">Apply a template…</option>{templates.map(t => <option value={t.id} key={t.id}>{t.title}</option>)}</select><button onClick={() => { setDraft(fresh('template', { title: release.title + ' checklist', checks: currentChecks.map(c => ({ title: c.title, feature: c.feature, expected: c.expected, steps: c.steps, goal: c.goal, why: c.why, platform: c.platform })) })); }}>Save as template</button></div></section><div className="view-tabs">{['All', ...platforms].map(p => <button className={platform === p ? 'selected' : ''} key={p} onClick={() => setPlatform(p)}>{p === 'All' ? 'All platforms' : p}</button>)}</div>{tools(currentChecks, true)}{[...new Set(select(currentChecks).map(c => c.feature || 'Ungrouped'))].map(f => <section className="panel mt" key={f}><div className="section-head"><h2>{f}</h2></div>{select(currentChecks).filter(c => (c.feature || 'Ungrouped') === f).map(row)}</section>)}{!select(currentChecks).length && empty('No checks')}</>}</>}
    {page === 'Defects & Retests' && <>{tools(checks, true)}<section className="panel">{select(checks.filter(c => c.result === 'Fail' || c.status === 'Dev Review' || c.status === 'Retesting')).map(r => <div key={r.id}>{row(r)}<div className="inline-actions"><button onClick={() => copy(defect(r))}>Copy defect report</button><button onClick={() => change(r, { status: 'Dev Review' })}>Dev review</button><button onClick={() => change(r, { status: 'Retesting' })}>Ready for retest</button><button onClick={() => open({ ...r, status: 'Retesting', result: 'Not Recorded' })}>Record retest</button></div></div>)}{!select(checks.filter(c => c.result === 'Fail' || c.status === 'Dev Review' || c.status === 'Retesting')).length && empty('No open defects or retests')}</section></>}
    {page === 'Settings' && <div className="settings-grid"><section className="panel settings"><h2>Data & recovery</h2><p>SQLite database · files stored on this server.</p><div className="actions"><button onClick={() => download('paaq-backup.json', JSON.stringify(state, null, 2))}>JSON backup</button><label className="button">Import JSON<input hidden type="file" accept="application/json" onChange={async (e) => { try {
        const f = e.target.files?.[0];
        if (!f)
            return;
        const d = JSON.parse(await f.text());
        if (!Array.isArray(d.records) || !d.records.every((r: any) => r.id && r.title && r.kind))
            throw Error('Invalid backup');
        if (confirm('Merge backup records? Matching IDs will be replaced. Existing records with other IDs are kept.'))
            await save([...state.records.filter(r => !d.records.some((x: Item) => x.id === r.id)), ...d.records]);
    }
    catch (e: any) {
        setError(e.message);
    } }}/></label><button onClick={() => setTrash(!trash)}>Recently deleted ({state.records.filter(r => r.deleted).length})</button></div><details className="help-details"><summary>Backup details</summary><p>JSON includes records and evidence references. Back up the data folder to preserve uploaded files.</p></details>{trash && state.records.filter(r => r.deleted).map(r => <div className="spread deleted" key={r.id}><span>{r.title} · {r.kind}</span><button onClick={() => change(r, { deleted: false })}>Restore</button></div>)}</section><section className="panel settings"><h2>Slack connection</h2><span className={'badge ' + (slack.connected ? 'green' : '')}>{slack.connected ? 'Connected' : 'Disconnected'}</span><details className="help-details"><summary>Slack setup</summary><p>Create a Slack app, set its OAuth redirect to your APP_URL/api/slack, and set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET on the server. Workspace approval may be required. Invite the bot to channels you want to import.</p><p className="hint">Scopes: channels:read, channels:history, groups:read, groups:history, users:read. Bot tokens may not access every thread; unavailable context is labelled. No messages are sent.</p></details>{!slack.connected ? <a className="button" href="/api/slack?connect=1">Connect with Slack</a> : <><div className="actions"><button onClick={async () => { const r = await fetch('/api/slack?channels=1'); const d = await r.json(); if (d.error)
        setError(d.error);
    else
        setChannels(d.channels); }}>Load channels</button><button onClick={async () => { await fetch('/api/slack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disconnect: true }) }); setSlack({ connected: false }); }}>Disconnect</button></div><select aria-label="Slack channel" value={channel} onChange={e => setChannel(e.target.value)}><option value="">Select channel</option>{channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="filters"><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e => setTo(e.target.value)}/></label></div><button disabled={syncing || !channel} className="primary" onClick={async () => { setSyncing(true); setError(''); try {
        const r = await fetch('/api/slack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, from, to }) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error);
        const imported = d.messages.filter((m: any) => !state.records.some(r => r.slackId === channel + ':' + m.ts)).map((m: any) => fresh('message', { title: (m.text || 'Slack message').slice(0, 100), text: m.text, sender: m.sender, slackAuthor: m.user, date: new Date(Number(m.ts) * 1000).toISOString(), channel: channels.find(c => c.id === channel)?.name || channel, source: m.permalink, thread: m.thread, slackId: channel + ':' + m.ts, status: 'Needs response' }));
        if (await save([...state.records, ...imported])) {
            setSlack({ ...slack, lastSync: d.lastSync });
            setNotice(`Imported ${imported.length} messages for review.`);
        }
    }
    catch (e: any) {
        setError(e.message);
    }
    finally {
        setSyncing(false);
    } }}>{syncing ? 'Importing messages and thread context…' : 'Import for review'}</button></>}<p className="hint">Last sync: {slack.lastSync || 'Never'}</p></section><section className="panel settings"><div className="spread"><h2>Meeting reminders</h2><button onClick={() => newRecord('meeting')}>＋ Add</button></div>{meetings.map(row)}</section><section className="panel settings"><h2>Private access</h2><p>No account or workspace setup. For hosting, set APP_PASSWORD and COOKIE_SECURE=true, use HTTPS, and mount a persistent data volume. Secrets stay on the server.</p></section></div>}
    </div></main>
        {draft && <div className="overlay" onClick={e => { if (e.target === e.currentTarget && confirm('Close without saving changes?'))
            setDraft(null); }}><section className="modal" role="dialog" aria-modal="true" aria-label={'Edit ' + draft.kind}><div className="section-head"><div><p className="eyebrow">{draft.kind.toUpperCase()}</p><h2>{state.records.some(r => r.id === draft.id) ? 'Edit details' : 'New ' + draft.kind}</h2></div><button aria-label="Close editor" onClick={() => { if (confirm('Close without saving changes?'))
            setDraft(null); }}>✕</button></div><form onSubmit={e => { e.preventDefault(); commit(); }}><div className="form-content">{fields([['title', draft.kind === 'release' ? 'Release name *' : 'Title *']])}{draft.kind === 'release' ? <>{dropdown('product', 'Product *', products, true)}<details><summary>Release details</summary>{fields([['build', 'Build / version'], ['scope', 'Scope', 'textarea'], ['goal', 'Release goal', 'textarea'], ['notes', 'Notes', 'textarea'], ['testingUrl', 'Testing URL (optional)', 'url']])}{dropdown('environment', 'Environment', ['Staging', 'Production'], true)}</details></> : null}
        {['task', 'check'].includes(draft.kind) && <><div className="form-grid">{dropdown('status', 'Workflow status', draft.kind === 'check' ? checkStatuses : statuses)}{draft.kind === 'check' ? dropdown('result', 'Result', results) : dropdown('product', 'Product', products, true)}{dropdown('priority', 'Priority', ['High', 'Normal', 'Low'])}{dropdown('platform', 'Platform', platforms, true)}</div>{draft.kind === 'check' && <details className="help-details"><summary>About results</summary><p>Saving a result adds a history entry. Previous failures and evidence are preserved.</p></details>}{fields([['nextStep', 'Next step'], ['blocker', 'Blocker']])}<details><summary>Feature & supporting details</summary>{fields([['description', 'Description', 'textarea'], ['feature', 'Feature'], ['goal', 'Feature goal', 'textarea'], ['why', 'Why this matters to PAAQ', 'textarea'], ['due', 'Due date', 'date'], ['clarification', 'Needs clarification'], ['notes', 'Notes', 'textarea'], ['slackLink', 'Slack source link', 'url']])}<label>Related release<select value={draft.releaseId || ''} onChange={e => setDraft({ ...draft, releaseId: e.target.value })}><option value="">Not set</option>{releases.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>{draft.kind === 'task' && <label>Related test check<select value={draft.checkId || ''} onChange={e => setDraft({ ...draft, checkId: e.target.value })}><option value="">Not set</option>{checks.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>}</details>{draft.kind === 'check' && <><details><summary>Test details & defect report</summary>{fields([['expected', 'Expected behaviour', 'textarea'], ['actual', 'Actual result', 'textarea'], ['preconditions', 'Preconditions', 'textarea'], ['steps', 'Test / reproduction steps', 'textarea'], ['device', 'Device'], ['os', 'Operating system version'], ['version', 'Browser or app / build version'], ['defect', 'Defect wording', 'textarea'], ['retest', 'Retest outcome', 'textarea']])}{dropdown('severity', 'Severity', ['Critical', 'Major', 'Minor', 'Cosmetic'], true)}<button type="button" onClick={() => copy(defect(draft))}>Copy defect report</button></details><details><summary>Evidence (optional)</summary>{fields([['evidenceLinks', 'Evidence links', 'textarea']])}<label>Upload files (up to 20 MB each)<input type="file" multiple onChange={async (e) => { const files = Array.from(e.target.files || []); let added = [...(draft.files || [])]; try {
            const config = await fetch('/api/evidence?config=1');
            if (!config.ok)
                throw Error(await config.text());
            const { directUpload } = await config.json();
            for (const file of files) {
                if (directUpload) {
                    const id = crypto.randomUUID();
                    await upload(`evidence/${id}`, file, { access: 'private', contentType: file.type || 'application/octet-stream', handleUploadUrl: '/api/evidence/upload', multipart: file.size > 5 * 1024 * 1024 });
                    added.push({ id, name: file.name, size: file.size });
                }
                else {
                    const data = new FormData();
                    data.append('file', file);
                    const r = await fetch('/api/evidence', { method: 'POST', body: data });
                    if (!r.ok)
                        throw Error(await r.text());
                    added.push(await r.json());
                }
            }
            setDraft({ ...draft, files: added });
            setNotice('Files uploaded. Save this check to attach them.');
        }
        catch (e: any) {
            setDraft({ ...draft, files: added });
            setError(e.message);
        } }}/></label>{(draft.files || []).map((f: any) => <div className="spread" key={f.id}><a href={'/api/evidence?id=' + f.id}>{f.name}</a><button type="button" onClick={() => setDraft({ ...draft, files: draft.files.filter((a: any) => a.id !== f.id) })}>Remove reference</button></div>)}</details><details><summary>Result history ({draft.history?.length || 0})</summary>{(draft.history || []).map(h => <div className="history" key={h.id}><strong>{h.result} · {h.recordedAt}</strong><p>{h.actual || 'No actual result recorded'}</p><p>{h.retest}</p><p>{h.blocker && 'Blocker: ' + h.blocker}</p><p>{h.evidenceLinks}</p>{(h.files || []).map((f: any) => <a key={f.id} href={'/api/evidence?id=' + f.id}>{f.name} </a>)}</div>)}</details></>}</>}
        {draft.kind === 'message' && <>{fields([['text', 'Message text', 'textarea'], ['sender', 'Sender'], ['date', 'Date', 'date'], ['channel', 'Channel'], ['source', 'Source link', 'url']])}{dropdown('status', 'State', ['Needs response', 'Reviewed', 'Resolved'])}<label>Linked task, check or release<select value={draft.linkedId || ''} onChange={e => setDraft({ ...draft, linkedId: e.target.value })}><option value="">Not linked</option>{live.filter(r => ['task', 'check', 'release'].includes(r.kind)).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>{draft.linkedId && <button type="button" onClick={() => { const r = live.find(r => r.id === draft.linkedId); if (r)
            open(r); }}>Open linked record</button>}{draft.thread && <details><summary>Thread context</summary><pre>{draft.thread}</pre></details>}</>}
        {draft.kind === 'meeting' && <>{dropdown('recurrence', 'Repeats', ['Weekly', 'First Monday'])}{dropdown('day', 'Day', draft.recurrence === 'First Monday' ? ['Monday'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])}{fields([['time', 'Time · Africa/Johannesburg', 'time']])}</>}
        {draft.kind === 'template' && <><details className="help-details"><summary>About templates</summary><p>Copies instructions only. Results, blockers and evidence start empty.</p></details>{(draft.checks || []).map((c: any, i: number) => <div className="template-check" key={i}>{(['title', 'feature', 'expected', 'steps', 'goal', 'why', 'platform'] as const).map(k => <label key={k}>{k}<input value={c[k] || ''} onChange={e => setDraft({ ...draft, checks: draft.checks.map((a: any, j: number) => i === j ? { ...a, [k]: e.target.value } : a) })}/></label>)}<button type="button" onClick={() => setDraft({ ...draft, checks: draft.checks.filter((_: any, j: number) => j !== i) })}>Remove check</button></div>)}<button type="button" onClick={() => setDraft({ ...draft, checks: [...(draft.checks || []), { title: '', platform: 'Web' }] })}>＋ Add checklist item</button></>}
        {draft.kind === 'report' && fields([['text', 'Report', 'textarea']])}
        {error && <p className="danger" role="alert">{error}</p>}</div><div className="modal-footer"><div className="actions">{state.records.some(r => r.id === draft.id) && <button className="danger" type="button" onClick={() => remove(draft)}>Delete</button>}{draft.kind === 'check' && <select aria-label="Duplicate check to platform" value="" onChange={e => { const copy = fresh('check', { ...draft, id: crypto.randomUUID(), title: draft.title, platform: e.target.value, history: [], files: [], actual: '', blocker: '', defect: '', retest: '', evidenceLinks: '', status: 'Not Started', result: 'Not Recorded' }); setDraft(copy); }}><option value="">Copy to platform…</option>{platforms.map(p => <option key={p}>{p}</option>)}</select>}</div><button disabled={saveState === 'Saving'} className="primary" type="submit">{saveState === 'Saving' ? 'Saving…' : 'Save ' + draft.kind}</button></div></form></section></div>}
    </div>;
}
