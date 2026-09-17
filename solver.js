/* =====================================================================
   PlanningMaster, solveur

   Cherche le meilleur planning possible pour un scénario donné. Sert
   à deux choses : montrer au joueur ce qu'il aurait pu faire, et
   vérifier automatiquement qu'un niveau garde bien une solution à 100
   quand on touche aux règles.

   Méthode : construction gloutonne, puis recherche locale avec
   redémarrages. Le problème est trop gros pour être énuméré (cinq
   services, dix salariés, sept jours), mais les instances sont petites
   et le paysage assez régulier pour qu'une descente suffise.

   Aucune dépendance au DOM ni à la langue, comme le moteur.
   ===================================================================== */
import { SHIFTS, evaluate, emptyPlan, applyLocks, isLocked } from './game-core.js';

const CODES = ['R', 'P', 'M', 'S', 'C'];

/* Un score composite : le score du jeu d'abord, le coût ensuite.
   À score égal, un planning moins cher est meilleur. */
function fitness(S, plan) {
  const ev = evaluate(S, plan);
  return { ev, f: ev.score * 1e6 - ev.total };
}

function clone(plan) {
  const c = {};
  for (const k in plan) c[k] = plan[k].slice();
  return c;
}

/* Cases réellement modifiables : ni fermeture, ni congé, ni arrêt. */
function freeCells(S) {
  const cells = [];
  S.equipe.forEach(em => {
    for (let d = 0; d < 7; d++) if (!isLocked(S, em, d)) cells.push([em.id, d]);
  });
  return cells;
}

/* ---------------------------------------------------------------------
   Construction gloutonne : on couvre les services les plus tendus
   d'abord, en préférant la coupure quand le midi et le soir sont tous
   deux demandés, et en gardant deux repos à chacun.
   --------------------------------------------------------------------- */
function greedy(S, rnd) {
  const plan = applyLocks(S, emptyPlan(S));
  const jours = S.jours.map((j, d) => ({ d, j, charge: j.ferme ? -1 :
    j.besoin.midi.cuisine + j.besoin.midi.salle + j.besoin.soir.cuisine + j.besoin.soir.salle }))
    .filter(x => x.charge > 0)
    .sort((a, b) => b.charge - a.charge);

  jours.forEach(({ d, j }) => {
    ['cuisine', 'salle'].forEach(pole => {
      const needM = j.besoin.midi[pole], needS = j.besoin.soir[pole];
      const pres = () => S.equipe.filter(em => em.pole === pole);
      const cov = sv => pres().filter(em => SHIFTS[plan[em.id][d]].couvre.includes(sv)).length;

      // qui peut encore travailler ce jour-là, en gardant deux repos
      const dispo = () => pres().filter(em => {
        if (isLocked(S, em, d) || plan[em.id][d] !== 'R') return false;
        const repos = plan[em.id].filter(c => c === 'R').length;
        return repos > 2;
      }).sort((a, b) => {
        const ha = plan[a.id].reduce((s, c) => s + SHIFTS[c].h, 0);
        const hb = plan[b.id].reduce((s, c) => s + SHIFTS[c].h, 0);
        // on charge d'abord ceux qui sont loin de leur contrat, et
        // les responsables en premier tant qu'aucun n'est placé
        return (ha / a.contrat) - (hb / b.contrat);
      });

      let garde = 40;
      while ((cov('midi') < needM || cov('soir') < needS) && garde-- > 0) {
        const manqueM = cov('midi') < needM, manqueS = cov('soir') < needS;
        const libres = dispo();
        if (!libres.length) break;
        // un responsable d'abord si le service n'en a aucun
        const sv = manqueM ? 'midi' : 'soir';
        const aResp = pres().some(em => em.resp && SHIFTS[plan[em.id][d]].couvre.includes(sv));
        const cible = (!aResp && libres.find(em => em.resp)) || libres[0];
        const code = (manqueM && manqueS) ? 'C' : (manqueM ? 'M' : 'S');
        plan[cible.id][d] = code;
      }
    });
  });
  // un peu de bruit pour que les redémarrages explorent autre chose
  if (rnd) {
    const cells = freeCells(S);
    const n = Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const [id, d] = cells[Math.floor(rnd() * cells.length)];
      plan[id][d] = CODES[Math.floor(rnd() * CODES.length)];
    }
  }
  return plan;
}

/* ---------------------------------------------------------------------
   Voisinage. Le simple changement d'une case ne suffit pas : beaucoup
   d'améliorations demandent une compensation ailleurs (donner un service
   à quelqu'un d'autre, décaler un repos). D'où trois familles de
   mouvements, dont deux échanges qui préservent la couverture.
   --------------------------------------------------------------------- */
function* voisins(S, plan, cells, parPole) {
  // 1. changer une case
  for (const [id, d] of cells) {
    const avant = plan[id][d];
    for (const code of CODES) {
      if (code === avant) continue;
      yield { do: () => { plan[id][d] = code; }, undo: () => { plan[id][d] = avant; } };
    }
  }
  // 2. échanger deux salariés du même pôle sur le même jour :
  //    la couverture ne bouge pas, la répartition des heures si
  for (let d = 0; d < 7; d++) {
    if (S.jours[d].ferme) continue;
    for (const pole in parPole) {
      const g = parPole[pole];
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
        const a = g[i], b = g[j];
        if (isLocked(S, a, d) || isLocked(S, b, d)) continue;
        if (plan[a.id][d] === plan[b.id][d]) continue;
        yield {
          do: () => { const t = plan[a.id][d]; plan[a.id][d] = plan[b.id][d]; plan[b.id][d] = t; },
          undo: () => { const t = plan[a.id][d]; plan[a.id][d] = plan[b.id][d]; plan[b.id][d] = t; },
        };
      }
    }
  }
  // 3. échanger les semaines entières de deux salariés du même pôle.
  //    Mouvement macro : il traverse d'un coup des vallées que les
  //    échanges case par case ne franchissent pas.
  for (const pole in parPole) {
    const g = parPole[pole];
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const a = g[i], b = g[j];
      // interdit si l'un des deux a des indisponibilités : sa semaine
      // n'est pas transposable telle quelle
      if (a.indispo && Object.keys(a.indispo).length) continue;
      if (b.indispo && Object.keys(b.indispo).length) continue;
      const swap = () => { const t = plan[a.id]; plan[a.id] = plan[b.id]; plan[b.id] = t; };
      yield { do: swap, undo: swap };
    }
  }
  // 4. échanger deux jours d'un même salarié : déplace un repos sans
  //    changer son volume horaire
  for (const em of S.equipe) {
    for (let d1 = 0; d1 < 7; d1++) for (let d2 = d1 + 1; d2 < 7; d2++) {
      if (isLocked(S, em, d1) || isLocked(S, em, d2)) continue;
      if (plan[em.id][d1] === plan[em.id][d2]) continue;
      yield {
        do: () => { const t = plan[em.id][d1]; plan[em.id][d1] = plan[em.id][d2]; plan[em.id][d2] = t; },
        undo: () => { const t = plan[em.id][d1]; plan[em.id][d1] = plan[em.id][d2]; plan[em.id][d2] = t; },
      };
    }
  }
}

/* Descente : on prend le meilleur voisin tant qu'il améliore. */
function climb(S, plan, deadline) {
  const cells = freeCells(S);
  const parPole = {};
  S.equipe.forEach(em => { (parPole[em.pole] = parPole[em.pole] || []).push(em); });

  let bf = fitness(S, plan).f;
  let bouge = true;
  while (bouge) {
    bouge = false;
    let meilleur = null, meilleurF = bf;
    for (const mv of voisins(S, plan, cells, parPole)) {
      if (Date.now() > deadline) return { plan, f: bf };
      mv.do();
      const f = fitness(S, plan).f;
      mv.undo();
      if (f > meilleurF) { meilleurF = f; meilleur = mv; }
    }
    if (meilleur) { meilleur.do(); bf = meilleurF; bouge = true; }
  }
  return { plan, f: bf };
}

/* Secousse : on casse quelques cases au hasard pour repartir d'ailleurs
   sans tout perdre. C'est ce qui permet de sortir des plateaux. */
function secouer(S, plan, cells, rnd, force) {
  // une fois sur trois : on refait la semaine entière d'un salarié,
  // ce qui déplace la solution bien plus loin qu'un bruit ponctuel
  if (rnd() < 0.34) {
    const em = S.equipe[Math.floor(rnd() * S.equipe.length)];
    for (let d = 0; d < 7; d++) {
      if (isLocked(S, em, d)) continue;
      plan[em.id][d] = CODES[Math.floor(rnd() * CODES.length)];
    }
    return;
  }
  for (let i = 0; i < force; i++) {
    const [id, d] = cells[Math.floor(rnd() * cells.length)];
    plan[id][d] = CODES[Math.floor(rnd() * CODES.length)];
  }
}

/* ---------------------------------------------------------------------
   solve(scenario, options)
   Renvoie { plan, ev, score, cost, iterations, ms, optimal }
   `optimal` n'affirme rien de plus que « score 100 atteint ».
   --------------------------------------------------------------------- */
export function solve(S, opts = {}) {
  const budgetMs = opts.ms ?? 2500;
  const maxIter = opts.iterations ?? 400;
  const t0 = Date.now();
  const deadline = t0 + budgetMs;

  let seed = opts.seed ?? 12345;
  const rnd = () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const cells = freeCells(S);
  let best = climb(S, greedy(S, null), deadline).plan;
  let bf = fitness(S, best).f;
  let tours = 1;

  // recherche locale itérée : secouer, redescendre, garder si c'est mieux
  while (Date.now() < deadline && tours < maxIter && fitness(S, best).ev.score < 100) {
    const essai = clone(best);
    secouer(S, essai, cells, rnd, 2 + Math.floor(rnd() * 4));
    const { plan, f } = climb(S, essai, deadline);
    tours++;
    if (f > bf) { bf = f; best = plan; }
  }

  const { ev } = fitness(S, best);
  return {
    plan: best,
    ev,
    score: ev.score,
    cost: Math.round(ev.total),
    restarts: tours,
    ms: Date.now() - t0,
    optimal: ev.score === 100,
  };
}

/* Écart entre le planning du joueur et la meilleure solution trouvée,
   en points et en euros, avec le détail par catégorie. */
export function compare(S, plan, opts) {
  const mine = evaluate(S, plan);
  const ref = solve(S, opts);
  const parCat = c => mine.issues.filter(i => i.cat === c).reduce((s, i) => s + i.pts, 0);
  return {
    score: mine.score,
    refScore: ref.score,
    cost: Math.round(mine.total),
    refCost: ref.cost,
    perdus: {
      legal: parCat('legal'),
      couv: parCat('couv'),
      eco: parCat('eco'),
      conf: parCat('conf'),
    },
    issues: mine.issues,
    refPlan: ref.plan,
    ms: ref.ms,
  };
}
