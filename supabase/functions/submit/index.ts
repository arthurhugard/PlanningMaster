// =====================================================================
//  PlanningMaster — validation des scores
//
//  Le client n'envoie jamais un score, il envoie une grille de planning.
//  Cette fonction reconstruit le scénario de son côté, assainit la grille
//  (cases verrouillées, codes inventés), recalcule le score avec le même
//  moteur que le jeu, et n'écrit que son propre résultat.
//
//  C'est la seule voie d'écriture dans la table scores : les règles RLS
//  n'accordent aucun droit d'insertion au client.
//
//  Déploiement :  supabase functions deploy submit
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  LEVELS,
  evaluate,
  sanitizePlan,
  generateWeek,
  newSeason,
  seasonScenario,
  applySeasonWeek,
  SEASON_WEEKS,
} from "../_shared/game-core.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ---- identité -----------------------------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // ---- entrée -------------------------------------------------------
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const mode = String(body?.mode ?? "");
  if (!["level", "seed", "season"].includes(mode)) {
    return json({ error: "bad_mode" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ---- garde-fou anti-martèlement ------------------------------------
  const { data: allowed } = await admin.rpc("can_submit", { uid: user.id });
  if (allowed === false) return json({ error: "rate_limited" }, 429);

  // ---- recalcul ------------------------------------------------------
  let ref = "";
  let score = 0;
  let payroll = 0;
  let treasury: number | null = null;
  let stored: unknown = null;

  try {
    if (mode === "level") {
      const level = LEVELS.find((l: any) => l.id === String(body.ref));
      if (!level) return json({ error: "unknown_level" }, 400);
      ref = level.id;
      const plan = sanitizePlan(level, body.grid);
      const ev = evaluate(level, plan);
      score = ev.score;
      payroll = Math.round(ev.total);
      stored = plan;
    } else if (mode === "seed") {
      // ref attendu : "GRAINE:difficulté", ex. "7KF2A:3"
      const m = /^([A-Z0-9]{1,12}):([1-5])$/.exec(String(body.ref ?? ""));
      if (!m) return json({ error: "bad_ref" }, 400);
      ref = `${m[1]}:${m[2]}`;
      const scen = generateWeek(m[1], Number(m[2]));
      const plan = sanitizePlan(scen, body.grid);
      const ev = evaluate(scen, plan);
      score = ev.score;
      payroll = Math.round(ev.total);
      stored = plan;
    } else {
      // saison : on rejoue les dix semaines depuis l'état initial.
      // Impossible de valider une semaine isolée, son scénario dépend
      // de la fatigue et du moral accumulés.
      const grids = body.grids;
      if (!Array.isArray(grids) || grids.length !== SEASON_WEEKS.length) {
        return json({ error: "bad_season_grids" }, 400);
      }
      ref = "season";
      const st = newSeason();
      let payrollTotal = 0;
      for (let w = 0; w < SEASON_WEEKS.length; w++) {
        const scen = seasonScenario(st);
        const plan = sanitizePlan(scen, grids[w]);
        st.plan = plan;
        const ev = evaluate(scen, plan);
        payrollTotal += ev.total;
        applySeasonWeek(st, scen, ev);
      }
      score = Math.round(
        st.scores.reduce((a: number, c: number) => a + c, 0) / st.scores.length,
      );
      payroll = Math.round(payrollTotal);
      treasury = Math.round(st.tresorerie);
      stored = grids;
    }
  } catch (_e) {
    return json({ error: "replay_failed" }, 400);
  }

  // ---- on ne garde que le meilleur -----------------------------------
  const { data: prev } = await admin
    .from("scores")
    .select("id, score")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .eq("ref", ref)
    .maybeSingle();

  if (prev && prev.score >= score) {
    return json({ ok: true, score, best: prev.score, improved: false });
  }

  const row = {
    user_id: user.id,
    mode,
    ref,
    score,
    payroll,
    treasury,
    grid: stored,
  };

  const { error } = prev
    ? await admin.from("scores").update(row).eq("id", prev.id)
    : await admin.from("scores").insert(row);

  if (error) return json({ error: "write_failed", detail: error.message }, 500);

  return json({ ok: true, score, best: score, improved: true });
});
