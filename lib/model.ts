export const products = ['PAAQ Events', 'PAAQ app', 'Ops Hub'];
export const statuses = ['Not Started', 'In Progress', 'Testing', 'Dev Review', 'Retesting', 'Done'];
export const checkStatuses = statuses.filter(s => s !== 'In Progress');
export const results = ['Not Recorded', 'Pass', 'Fail', 'Blocked'];
export const platforms = ['Web', 'iPhone', 'Android'];
export type RecordItem = {
    id: string;
    kind: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    deleted?: boolean;
    history?: RecordItem[];
    [key: string]: any;
};
export type State = {
    revision: number;
    records: RecordItem[];
};
export function fresh(kind: string, fields: Partial<RecordItem> = {}): RecordItem { const now = new Date().toISOString(); return { id: crypto.randomUUID(), kind, title: '', createdAt: now, updatedAt: now, status: 'Not Started', result: 'Not Recorded', priority: 'Normal', ...fields }; }
export function applyTemplate(template: RecordItem, releaseId: string): RecordItem[] { return (template.checks || []).filter((c: any) => typeof c.title === 'string' && c.title.trim()).map((c: any) => fresh('check', { title: c.title, feature: c.feature || '', expected: c.expected || '', steps: c.steps || '', goal: c.goal || '', why: c.why || '', platform: c.platform || 'Web', releaseId })); }
export function outstanding(checks: RecordItem[]) { return checks.filter(c => c.result !== 'Pass' || c.status !== 'Done' || c.blocker || c.clarification); }
export function attention(records: RecordItem[], today: string) { const active = records.filter(r => !r.deleted); return active.filter(r => r.kind === 'message' ? r.status === 'Needs response' && !active.some(a => a.id === r.linkedId && (a.blocker || a.status === 'Retesting' || a.clarification)) : ['task', 'check'].includes(r.kind) && (r.blocker || r.clarification || r.status === 'Retesting' || (r.status !== 'Done' && r.due && r.due < today))); }
export function recordResult(check: RecordItem, patch: Partial<RecordItem>): RecordItem { const changed = patch.result && patch.result !== 'Not Recorded'; return { ...check, ...patch, updatedAt: new Date().toISOString(), history: changed ? [...(check.history || []), { ...check, ...patch, id: crypto.randomUUID(), history: undefined, recordedAt: new Date().toISOString() }] : check.history }; }
export function report(records: RecordItem[], release?: RecordItem, from?: string, to?: string) {
    const live = records.filter(r => !r.deleted);
    const inRange = (date: string) => !!date && (!from || date.slice(0, 10) >= from) && (!to || date.slice(0, 10) <= to);
    const scope = live.filter(r => ['task', 'check'].includes(r.kind) && (!release || r.releaseId === release.id) && (release || inRange(r.updatedAt) || inRange(r.createdAt) || (r.history || []).some(h => inRange(h.recordedAt)) || (r.activity || []).some((d: string) => inRange(d))));
    const lines = [release ? release.title + ' · ' + release.product : 'Weekly review · ' + (from || 'All dates') + ' – ' + (to || 'Today')];
    if (release) {
        const context = [release.environment, release.build].filter(Boolean).join(' · ');
        if (context)
            lines.push(context);
    }
    function section(label: string, items: RecordItem[], detail?: (r: RecordItem) => string) { lines.push('\n' + label); if (!items.length) {
        lines.push('• None recorded');
        return;
    } const groups = new Map<string, RecordItem[]>(); for (const r of items) {
        const p = r.product || release?.product || live.find(a => a.id === r.releaseId)?.product || 'Product not set';
        const key = p + (r.feature ? ' / ' + r.feature : '');
        groups.set(key, [...(groups.get(key) || []), r]);
    } for (const [key, rs] of groups) {
        lines.push(key);
        for (const r of rs)
            lines.push('• ' + r.title + (detail ? ': ' + detail(r) : ''));
    } }
    section('What I worked on', scope);
    section('Verified functionality', scope.filter(r => r.result === 'Pass'));
    section('Work in progress / carry over', scope.filter(r => r.status !== 'Done'));
    section('Open defects', scope.filter(r => r.result === 'Fail'));
    section('Historical failures passed on retest', scope.filter(r => r.result === 'Pass' && r.history?.some(h => h.result === 'Fail')));
    section('Unresolved blockers', scope.filter(r => r.blocker), r => r.blocker);
    section('Pending retests', scope.filter(r => r.status === 'Retesting'));
    section('Clarification needed', scope.filter(r => r.clarification), r => r.clarification);
    section('Feature goals and value', scope, r => (r.goal || 'Needs clarification') + ' — ' + (r.why || 'Needs clarification'));
    section('Next steps', scope.filter(r => r.nextStep).sort((a, b) => ['High', 'Normal', 'Low'].indexOf(a.priority) - ['High', 'Normal', 'Low'].indexOf(b.priority)).slice(0, 3), r => r.nextStep);
    return lines.join('\n');
}
export function defect(r: RecordItem) { return `${r.title}\nSteps: ${r.steps || 'Not recorded'}\nExpected: ${r.expected || 'Not recorded'}\nActual: ${r.actual || 'Not recorded'}\nPlatform: ${[r.platform, r.device, r.os, r.version].filter(Boolean).join(', ') || 'Not recorded'}\nSeverity: ${r.severity || 'Not recorded'} · Priority: ${r.priority || 'Not recorded'}\nEvidence: ${r.evidenceLinks || 'Not recorded'}\n${(r.files || []).map((f: any) => f.name + ' — /api/evidence?id=' + f.id).join('\n')}\nRetest history:\n${(r.history || []).map(h => `${h.recordedAt}: ${h.result} — ${h.actual || ''} ${h.retest || ''}`).join('\n') || 'None recorded'}`; }
