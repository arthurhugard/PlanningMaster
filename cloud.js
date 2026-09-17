/* =====================================================================
   PlanningMaster — accès Supabase
   Comptes, scores vérifiés, classements, progression.

   Pas de SDK : l'API REST et l'API Auth de Supabase s'appellent très bien
   en fetch, et le jeu reste sans dépendance. La clé ci-dessous est la clé
   publique « anon » : elle est faite pour vivre dans le navigateur et ne
   donne accès à rien sans authentification, les règles RLS s'en chargent.
   ===================================================================== */

const URL_BASE = "https://kvqjiqazqcpqtofpljsy.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWppcWF6cWNwcXRvZnBsanN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NDk1MzQsImV4cCI6MjEwNTIyNTUzNH0.b2KntkvhgGrE3b1A21WZ_5hhjv3n7x511fMNt4PaVk8";

const STORE = "pm_session";

let session = null;   // { access_token, refresh_token, user }
let profile = null;   // { id, pseudo }

/* ------------------------------ session ------------------------------ */
function persist() {
  try {
    if (session) localStorage.setItem(STORE, JSON.stringify(session));
    else localStorage.removeItem(STORE);
  } catch (_) {}
}
function restore() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) session = JSON.parse(raw);
  } catch (_) {}
}

async function refresh() {
  if (!session?.refresh_token) return false;
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!r.ok) { session = null; profile = null; persist(); return false; }
  const d = await r.json();
  session = { access_token: d.access_token, refresh_token: d.refresh_token, user: d.user };
  persist();
  return true;
}

/* Appel authentifié, avec une tentative de rafraîchissement sur 401. */
async function authed(path, opts = {}, retry = true) {
  if (!session) throw new Error("not_signed_in");
  const r = await fetch(`${URL_BASE}${path}`, {
    ...opts,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (r.status === 401 && retry && (await refresh())) {
    return authed(path, opts, false);
  }
  return r;
}

/* ------------------------------ comptes ------------------------------ */
export async function signUp(email, password, pseudo) {
  const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { pseudo } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || d.error_description || d.message || "signup_failed");
  if (d.access_token) {
    session = { access_token: d.access_token, refresh_token: d.refresh_token, user: d.user };
    persist();
    await loadProfile();
    return { confirmed: true };
  }
  // confirmation d'e-mail encore activée côté projet
  return { confirmed: false };
}

export async function signIn(email, password) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.msg || d.message || "signin_failed");
  session = { access_token: d.access_token, refresh_token: d.refresh_token, user: d.user };
  persist();
  await loadProfile();
  return profile;
}

export async function signOut() {
  try { await authed("/auth/v1/logout", { method: "POST" }); } catch (_) {}
  session = null; profile = null; persist();
}

async function loadProfile() {
  if (!session) return null;
  const r = await authed(
    `/rest/v1/profiles?id=eq.${session.user.id}&select=id,pseudo`,
  );
  if (!r.ok) return null;
  const rows = await r.json();
  profile = rows[0] || null;
  return profile;
}

export function currentUser() {
  if (!session) return null;
  return { id: session.user.id, email: session.user.email, pseudo: profile?.pseudo || null };
}

export async function init() {
  restore();
  if (!session) return null;
  // le jeton dure une heure : on rafraîchit d'entrée plutôt que d'attendre un 401
  await refresh();
  if (session) await loadProfile();
  return currentUser();
}

export async function setPseudo(pseudo) {
  if (!session) throw new Error("not_signed_in");
  const r = await authed(`/rest/v1/profiles?id=eq.${session.user.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ pseudo }),
  });
  if (!r.ok) throw new Error((await r.json()).message || "pseudo_taken");
  profile = (await r.json())[0];
  return profile;
}

/* ------------------------------- scores ------------------------------ */
/* On envoie la grille, jamais le score : le serveur recalcule. */
export async function submitScore(payload) {
  if (!session) throw new Error("not_signed_in");
  const r = await authed("/functions/v1/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "submit_failed");
  return d;   // { ok, score, best, improved }
}

export async function leaderboard(mode, ref, limit = 20) {
  const q = `/rest/v1/leaderboard?mode=eq.${encodeURIComponent(mode)}` +
            `&ref=eq.${encodeURIComponent(ref)}` +
            `&select=pseudo,score,payroll,treasury,created_at` +
            `&order=score.desc,created_at.asc&limit=${limit}`;
  const r = await fetch(`${URL_BASE}${q}`, { headers: { apikey: ANON } });
  if (!r.ok) throw new Error("leaderboard_failed");
  return r.json();
}

export async function myScores() {
  if (!session) return [];
  const r = await authed(
    `/rest/v1/scores?user_id=eq.${session.user.id}&select=mode,ref,score,payroll,treasury`,
  );
  return r.ok ? r.json() : [];
}

/* ---------------------------- progression ---------------------------- */
export async function saveProgress(data) {
  if (!session) return false;
  const r = await authed("/rest/v1/progress", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: session.user.id, data, updated_at: new Date().toISOString() }),
  });
  return r.ok;
}

export async function loadProgress() {
  if (!session) return null;
  const r = await authed(
    `/rest/v1/progress?user_id=eq.${session.user.id}&select=data`,
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0]?.data ?? null;
}
