// Product-usage tracking. Events aggregate per session (never one record per event) and are
// kept in localStorage. To share numbers across devices, set `remoteSink` to an object with
// `upsert(session)` and `list()` — e.g. a Supabase table or your own endpoint.
const LOCAL_KEY = "stocklana_sessions";
const MAX_EVENTS = 150;
const MAX_LOCAL_SESSIONS = 200;

export const SESSION_ID = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const startedAt = Date.now();
let events = [];
let flushTimer = null;
const listeners = new Set();
export let remoteSink = null;
export function setRemoteSink(sink) { remoteSink = sink; }

function readLocal() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); } catch { return {}; } }
function writeLocal(all) {
  try {
    const ids = Object.keys(all).sort((a, b) => all[b].started_at - all[a].started_at).slice(0, MAX_LOCAL_SESSIONS);
    const trimmed = {};
    ids.forEach((id) => { trimmed[id] = all[id]; });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(trimmed));
  } catch { /* storage unavailable */ }
}
export function currentSession() {
  return { session_id: SESSION_ID, started_at: startedAt, last_at: events.length ? events[events.length - 1].t : startedAt, n: events.length, events: events.slice() };
}
async function flush() {
  const row = currentSession();
  const all = readLocal();
  all[SESSION_ID] = row;
  writeLocal(all);
  listeners.forEach((fn) => fn());
  if (remoteSink) { try { await remoteSink.upsert(row); } catch { /* best effort */ } }
}
export function track(event, props = {}) {
  events.push({ t: Date.now(), e: event, p: props });
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 800);
}
export async function loadSessions() {
  const local = readLocal();
  local[SESSION_ID] = currentSession();
  let source = "local";
  if (remoteSink) {
    try { (await remoteSink.list()).forEach((r) => { if (r.session_id) local[r.session_id] = r; }); source = "shared"; } catch { /* local only */ }
  }
  return { sessions: Object.values(local), source };
}
export function onAnalyticsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
