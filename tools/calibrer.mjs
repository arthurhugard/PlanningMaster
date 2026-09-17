/* Vérifie qu'une solution à 100 existe pour chaque épreuve et propose
   le budget minimal qui la rend atteignable.
   Usage : node tools/calibrer.mjs [levels|seeds|season] [ms] */
import { LEVELS, TUTORIAL, generateWeek, newSeason, seasonScenario,
         applySeasonWeek, SEASON_WEEKS, evaluate } from '../game-core.js';
import { solve } from '../solver.js';

const quoi = process.argv[2] || 'levels';
const MS = Number(process.argv[3] || 6000);

function test(nom, S) {
  const r = solve(S, { ms: MS });
  const dep = r.ev.issues.filter(i => i.code !== 'BUDGET');
  const perte = dep.reduce((s, i) => s + i.pts, 0);
  const marque = r.score === 100 ? 'OK ' : '!! ';
  console.log(
    `${marque}${nom.padEnd(22)} score ${String(r.score).padStart(3)}  ` +
    `coût ${String(r.cost).padStart(5)} €  budget ${String(S.budget).padStart(5)} €  ` +
    `(${r.cost <= S.budget ? 'dans' : 'HORS +' + (r.cost - S.budget)} )  ` +
    (perte ? 'restes: ' + dep.map(i => i.code).join(',') : ''));
  return r;
}

if (quoi === 'levels') {
  test('tutoriel', TUTORIAL);
  LEVELS.forEach(L => test(L.id + ' ' + (L.titre.fr || ''), L));
} else if (quoi === 'seeds') {
  const graines = ['7KF2A', 'M3PQZ', 'X9BTR', 'L4WKC', 'D260917'];
  for (let diff = 1; diff <= 5; diff++) {
    graines.forEach(g => test(`${g} d${diff}`, generateWeek(g, diff)));
  }
} else {
  const st = newSeason();
  for (let w = 0; w < SEASON_WEEKS.length; w++) {
    const S = seasonScenario(st);
    const r = test('semaine ' + (w + 1), S);
    st.plan = r.plan;
    applySeasonWeek(st, S, evaluate(S, r.plan));
  }
  console.log('trésorerie finale', Math.round(st.tresorerie), '€');
}
