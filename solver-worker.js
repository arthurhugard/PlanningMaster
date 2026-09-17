/* Solveur en tâche de fond.
   La recherche prend jusqu'à deux secondes : hors du fil principal,
   sinon la page se fige pendant que le joueur lit son score.

   Message attendu : { kind:'level'|'seed', ref, plan, ms }
   Réponse         : { ok, score, refScore, cost, refCost, perdus, refPlan } */
import { LEVELS, TUTORIAL, evaluate, generateWeek } from './game-core.js';
import { solve } from './solver.js';

function scenarioDe(kind, ref) {
  if (kind === 'level') {
    if (ref === 'tuto') return TUTORIAL;
    return LEVELS.find(L => L.id === ref) || null;
  }
  const m = /^([A-Z0-9]{1,12}):([1-5])$/.exec(String(ref));
  return m ? generateWeek(m[1], Number(m[2])) : null;
}

self.onmessage = (e) => {
  const { kind, ref, plan, ms } = e.data || {};
  const S = scenarioDe(kind, ref);
  if (!S) { self.postMessage({ ok: false }); return; }

  const mine = evaluate(S, plan);
  const best = solve(S, { ms: ms ?? 2000 });
  const parCat = c => mine.issues.filter(i => i.cat === c).reduce((s, i) => s + i.pts, 0);

  self.postMessage({
    ok: true,
    score: mine.score,
    refScore: best.score,
    cost: Math.round(mine.total),
    refCost: best.cost,
    perdus: {
      legal: parCat('legal'),
      couv: parCat('couv'),
      eco: parCat('eco'),
      conf: parCat('conf'),
    },
    refPlan: best.plan,
    ms: best.ms,
  });
};
