/* =====================================================================
   PlanningMaster, service worker

   Deux objectifs, et un seul piège à éviter.

   Objectif 1 : l'application s'installe et se lance hors ligne. Tout le
   jeu tient dans quatre fichiers statiques, le moteur tourne dans le
   navigateur : sans réseau, seuls les classements manquent.

   Objectif 2 : une mise en ligne se voit tout de suite. C'est le piège
   classique du cache : le joueur garde une vieille version pendant des
   jours sans comprendre pourquoi. D'où la stratégie « réseau d'abord »
   sur le HTML et le JavaScript. Le cache ne sert que de filet, quand le
   réseau est absent ou trop lent.

   Un détail qui compte : index.html importe game-core.js. Si l'un vient
   du réseau et l'autre d'un cache d'hier, les deux ne se comprennent
   plus. Les servir avec la même stratégie évite ce décalage.

   Les appels à Supabase ne passent jamais par ici : une réponse
   d'authentification ou de classement n'a rien à faire dans un cache.
   ===================================================================== */
const CACHE = 'planningmaster-v3';
const DELAI = 3500;            // au-delà, on sert le cache et on n'attend plus

// Ce qui doit être présent pour que le jeu démarre sans réseau.
const COQUILLE = [
  '/',
  '/index.html',
  '/game-core.js',
  '/cloud.js',
  '/solver.js',
  '/solver-worker.js',
  '/site.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll échoue en bloc si un seul fichier manque : on tolère les absents
    await Promise.all(COQUILLE.map(u => c.add(u).catch(() => {})));
    // la nouvelle version prend la main dès que la page le demande
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// La page peut demander la bascule immédiate après avoir prévenu le joueur.
self.addEventListener('message', e => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

/* Réseau d'abord, cache en secours, avec un délai plafonné. */
async function reseauDAbord(req) {
  const cache = await caches.open(CACHE);
  try {
    const rep = await Promise.race([
      fetch(req),
      new Promise((_, ko) => setTimeout(() => ko(new Error('lent')), DELAI)),
    ]);
    if (rep && rep.ok) cache.put(req, rep.clone());
    return rep;
  } catch (_) {
    const vieux = await cache.match(req, { ignoreSearch: true });
    if (vieux) return vieux;
    // navigation sans réseau ni cache exact : on retombe sur la page d'accueil
    if (req.mode === 'navigate') {
      const acc = await cache.match('/index.html') || await cache.match('/');
      if (acc) return acc;
    }
    throw _;
  }
}

/* Cache d'abord pour les images : leur contenu ne change pas sous le même nom. */
async function cacheDAbord(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const rep = await fetch(req);
  if (rep && rep.ok) cache.put(req, rep.clone());
  return rep;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase, polices, etc.

  if (req.mode === 'navigate' || /\.(js|webmanifest|json)$/.test(url.pathname)) {
    e.respondWith(reseauDAbord(req));
    return;
  }
  if (/\.(png|svg|ico|webp|jpg|woff2?)$/.test(url.pathname)) {
    e.respondWith(cacheDAbord(req));
  }
});
