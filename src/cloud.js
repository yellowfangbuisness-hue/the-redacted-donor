// Online records: leaderboard, run reports and cloud saves on Supabase.
// Everything is optional. With no network the game plays exactly as before; scores and runs wait in a
// local outbox and go out the next time a request succeeds.
// Guests: each device holds a random secret key; the database only accepts writes through functions that hash
// that key and touch that player's rows. Signed in, the account's token picks the player instead (see logIn).
const URL_ = __SUPABASE_URL__, KEY = __SUPABASE_KEY__;
const DEVICE = 'redacted-donor.cloud.key', OUTBOX = 'redacted-donor.cloud.outbox', NAME = 'redacted-donor.cloud.name',
  NAMED = 'redacted-donor.cloud.named', SYNC = 'redacted-donor.cloud.sync', CODE = 'redacted-donor.cloud.code', IGNORE = 'redacted-donor.cloud.ignore';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private window */ } };
const json = (k, fallback) => { try { const v = JSON.parse(get(k)) ?? fallback; return Array.isArray(fallback) && !Array.isArray(v) ? fallback : v; } catch { return fallback; } };   // a list stays a list even if storage was tampered with

function deviceKey() {
  let k = get(DEVICE);
  if (!/^[0-9a-f]{32,64}$/.test(k || '')) {
    k = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    put(DEVICE, k);
  }
  return k;
}

async function call(path, { method = 'GET', body, timeout = 7000, auth = true } = {}) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const bearer = auth ? await accessToken() : KEY;
    const res = await fetch(URL_ + path, { method, headers: { apikey: KEY, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
    const text = await res.text(), data = text ? JSON.parse(text) : null;
    if (!res.ok) throw Object.assign(new Error(data?.message || data?.msg || res.statusText), { status: res.status, code: data?.error_code || data?.code });
    return data;
  } finally { clearTimeout(timer); }
}
const rpc = (fn, args = {}) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: { p_key: deviceKey(), ...args } });

// ── Accounts (Supabase Auth). Signed in, every call carries the player's token and the database uses
// the account's player; signed out, the device key is the player (guest). ──
const SESSION = 'redacted-donor.cloud.account';
let session = json(SESSION, null), refreshing = null;
if (!session || typeof session.token !== 'string' || typeof session.email !== 'string') session = null;   // corrupt storage must not lock the game out
function keep(s) {
  session = s ? { token: s.access_token, refresh: s.refresh_token, expires: Date.now() + (s.expires_in || 3600) * 1000, email: s.user?.email || session?.email, id: s.user?.id || session?.id } : null;
  put(SESSION, session && JSON.stringify(session));
}
async function accessToken() {
  if (!session) return KEY;
  if (Date.now() < session.expires - 60000) return session.token;
  refreshing = refreshing || call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh }, auth: false })
    .then(keep, (e) => { if (e.status === 400 || e.status === 401) keep(null); throw e; }).finally(() => { refreshing = null; });
  await refreshing;
  return session ? session.token : KEY;
}
// Investigator IDs are stored as emails on a domain nobody receives mail for; confirm-email is off.
const ID_DOMAIN = '@players.redacted-donor.app';
const idEmail = (id) => String(id).trim().toLowerCase().replace(/\s+/g, '-') + ID_DOMAIN;
const authError = (e, kind) => {
  const c = e.code || '';
  const msg = /invalid_credentials|invalid_grant/.test(c) || /Invalid login/.test(e.message) ? `Wrong ${kind === 'id' ? 'investigator ID' : 'email'} or password.`
    : /user_already_exists|email_exists/.test(c) || /already registered/i.test(e.message) ? 'That account already exists. Sign in instead.'
    : /weak_password/.test(c) ? 'Use a password of at least 6 characters.'
    : /email_address_invalid|validation_failed/.test(c) ? 'That email address doesn’t look right.'
    : /over_.*rate_limit/.test(c) ? 'Too many tries. Wait a minute and try again.'
    : !e.status ? 'Can’t reach the records office. Check your connection.' : e.message;
  return Object.assign(new Error(msg), { status: e.status || 0 });
};

export const cloud = {
  // Signed-in account: { email, investigator } (investigator is set for ID logins), or null for a guest.
  account: () => session && { email: session.email, investigator: session.email?.endsWith(ID_DOMAIN) ? session.email.slice(0, -ID_DOMAIN.length) : '' },
  // kind: 'email' (address) or 'id' (investigator ID). `create` signs up instead of in.
  async logIn(kind, login, password, create = false) {
    login = String(login || '').trim();
    if (kind === 'id' && !cloud.validName(login)) throw new Error('Investigator IDs are 2–16 letters or numbers.');
    if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) throw new Error('That email address doesn’t look right.');
    if (String(password || '').length < 6) throw new Error('Use a password of at least 6 characters.');
    const email = kind === 'id' ? idEmail(login) : login.toLowerCase();
    await cloud.flush(); // guest results still waiting go to the guest before the account takes over
    let s;
    try { s = await call(create ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false }); }
    catch (e) { throw authError(e, kind); }
    if (!s?.access_token) throw new Error('Sign-up needs email confirmation. Turn off “Confirm email” in Supabase.');
    keep(s);
    put(NAMED, null); put(CODE, null); put(IGNORE, null);
    cloud.setSync(true); // signing in is asking for progress to follow the account
    let stats = await cloud.stats().catch(() => null);
    // A new account is named after the investigator ID, the guest's own name, or the start of the email.
    // (The database gives every player a default "Agent 1234" name, so this only improves on it.)
    const prefix = login.split('@')[0].replace(/[^A-Za-z0-9 _-]/g, ' ').trim().slice(0, 16);
    const want = create ? (kind === 'id' ? login : cloud.name() || (cloud.validName(prefix) ? prefix : '')) : '';
    if (want && want !== stats?.name) await cloud.setName(want).then(() => { stats = { ...stats, name: want }; }, () => {});
    put(NAME, stats?.name || null); put(NAMED, stats?.name || null);
    return { ...stats, name: cloud.name() };
  },
  async logOut() {
    await Promise.race([cloud.flush(), new Promise((r) => setTimeout(r, 3000))]);
    call('/auth/v1/logout', { method: 'POST' }).catch(() => {});
    keep(null);
    // A fresh guest: nothing from the account stays attached to this device.
    for (const k of [NAME, NAMED, CODE, DEVICE, OUTBOX, IGNORE]) put(k, null);
  },
  // Permanently removes this player's online data (and the account, when signed in), then resets this device to a fresh guest.
  async deleteAccount() {
    await rpc('delete_me');
    keep(null);
    for (const k of [NAME, NAMED, CODE, DEVICE, OUTBOX, IGNORE]) put(k, null);
    cloud.ignoreSavesUntilNow();
  },
  stats: () => rpc('my_stats'),
  name: () => get(NAME) || '',
  // 2–16 letters/numbers: the database checks the same rule plus a bad-word list.
  validName: (n) => /^[A-Za-z0-9][A-Za-z0-9 _-]{1,15}$/.test(n),
  async setName(name) {
    name = String(name).trim();
    if (!cloud.validName(name)) throw Object.assign(new Error('Use 2–16 letters or numbers.'), { status: 400 });
    await rpc('set_name', { p_name: name }).catch((e) => { throw e.code === '23514' ? Object.assign(new Error('Pick a different name.'), { status: 400 }) : e; });
    put(NAME, name); put(NAMED, name);
  },
  // Offline: keep the name; the outbox registers it before sending the score.
  rememberName(name) { put(NAME, name); put(NAMED, null); },
  submitScore(row) { cloud.queue('submit_score', row); return cloud.flush(); },
  logRun(row) { cloud.queue('log_run', row); cloud.flush(); },
  queue(fn, args) { const box = json(OUTBOX, []); box.push({ fn, args }); put(OUTBOX, JSON.stringify(box.slice(-40))); },
  pending: () => json(OUTBOX, []).filter((j) => j.fn === 'submit_score').length,
  lastPlace: 0,
  flushing: null,
  flush() {
    if (cloud.flushing) return cloud.flushing;
    cloud.flushing = (async () => {
      let box = json(OUTBOX, []), sent = 0;
      while (box.length) {
        const job = box[0];
        if (job.fn === 'submit_score') { // a score needs a registered name first
          if (!cloud.name()) break;
          if (get(NAMED) !== cloud.name()) { try { await cloud.setName(cloud.name()); } catch (e) { if (e.status === 400) put(NAME, null); break; } }
        }
        try { const out = await rpc(job.fn, job.args); if (job.fn === 'submit_score') cloud.lastPlace = out; }
        catch (e) { if (!e.status || e.status >= 500 || e.code === '54000') break; } // offline or throttled: retry later; a rejected row is dropped
        box = json(OUTBOX, []); box.shift(); put(OUTBOX, JSON.stringify(box)); sent++;
      }
      return sent;
    })().catch(() => 0).finally(() => { cloud.flushing = null; });
    return cloud.flushing;
  },
  leaderboard(veteran = false, limit = 50) {
    return call(`/rest/v1/leaderboard?select=name,score,cases_closed,rank,seconds,veteran&veteran=eq.${veteran}&order=score.desc,seconds.asc&limit=${limit}`);
  },
  // Cloud saves: on by default; the newest copy wins.
  syncOn: () => get(SYNC) !== 'off',
  setSync(on) { put(SYNC, on ? 'on' : 'off'); },
  // Uploads are batched: the latest snapshot goes out at most every 30 s (right away with `now`, e.g. on quit).
  pushTimer: 0, pushed: 0, latest: null,
  pushSave(snapshot, now = false) {
    if (!cloud.syncOn()) return;
    cloud.latest = snapshot;
    if (cloud.pushTimer && !now) return;
    clearTimeout(cloud.pushTimer);
    const wait = now ? 0 : Math.max(4000, cloud.pushed + 30000 - Date.now());
    cloud.pushTimer = setTimeout(() => {
      cloud.pushTimer = 0; cloud.pushed = Date.now();
      rpc('push_save', { p_data: cloud.latest }).then((code) => code && put(CODE, code)).catch(() => {});
    }, wait);
  },
  async pullSave() {
    if (!cloud.syncOn() || !get(DEVICE) && !session) return null;
    const row = await rpc('pull_save').catch(() => null);
    if (row?.code) put(CODE, row.code);
    // A save the player chose to delete on this device stays deleted here.
    if (row?.data && (row.data.savedAt || 0) <= Number(get(IGNORE) || 0)) return null;
    return row?.data || null;
  },
  ignoreSavesUntilNow() { put(IGNORE, String(Date.now())); },
  // The transfer code shown in the pause menu; type it on another device to carry the save over.
  code: () => get(CODE) || '',
  async loadCode(code) {
    const data = await call('/rest/v1/rpc/load_save_by_code', { method: 'POST', body: { c: String(code).trim() } });
    if (!data) throw new Error('No save matches that code.');
    return data;
  },
};
if (typeof window !== 'undefined') window.addEventListener('online', () => cloud.flush());
