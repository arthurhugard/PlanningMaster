# PlanningMaster

Simulateur de planning d'équipe en restauration, sous contraintes de droit du
travail français (convention HCR simplifiée). Site statique, sans build, publié
sur Vercel à `planningmaster.arthurhugard.com`.

Le projet appartient à Arthur Hugard, restaurateur et étudiant en management
hôtelier. Le jeu lui sert d'outil pédagogique et de vitrine.

---

## Comment lancer et vérifier

Aucun build, aucune dépendance à installer. Un serveur statique suffit :

```bash
python -m http.server 8080      # puis http://localhost:8080
```

Ouvrir `index.html` en `file://` ne marche pas : les modules ES et le service
worker exigent un vrai serveur.

Vérification du jeu, la seule qui compte vraiment :

```bash
node tools/calibrer.mjs levels     # les 5 niveaux + le tutoriel
node tools/calibrer.mjs seeds      # 25 semaines générées, 5 par difficulté
node tools/calibrer.mjs season     # les 10 semaines de la saison
```

Le solveur cherche la meilleure grille possible pour chaque scénario. Une ligne
qui commence par `!!` signale un scénario dont la meilleure solution trouvée
n'atteint pas 100/100. **Les cinq niveaux et le tutoriel doivent rester à
`OK`.** C'est la promesse faite au joueur sur la page des niveaux.

Publication : `publier.bat` (commit + push, Vercel redéploie).

---

## Architecture

Cinq fichiers portent tout le projet.

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'interface : CSS, gabarits, logique d'écran, i18n. ~3 400 lignes. |
| `game-core.js` | Le moteur. Règles, scénarios, générateur, saison. Sans DOM, sans langue. |
| `solver.js` | Recherche locale itérée. Sert au débriefing et à la vérification des niveaux. |
| `cloud.js` | Accès Supabase en `fetch` brut. Comptes, scores, classements, progression. |
| `sw.js` | Service worker. Installation, fonctionnement hors ligne, mises à jour. |

`solver-worker.js` fait tourner le solveur hors du fil principal.
`tools/calibrer.mjs` est le harnais de vérification.

### Le moteur ne connaît ni le DOM ni la langue

`game-core.js` tourne à l'identique dans le navigateur et dans l'Edge Function
Supabase. Il ne renvoie jamais de texte affichable : `evaluate()` produit des
codes d'infraction (`REST`, `OFF`, `COVER`, `LEAD`, `PAID`, `BUDGET`,
`APPR_SOIR`…) avec leurs arguments, et `index.html` les traduit dans
`fmtIssue()`. Ne jamais mettre de chaîne destinée à l'écran dans le moteur.

### L'interface est un seul fichier, volontairement

Pas de framework, pas de bundler, pas de `node_modules`. Les écrans sont des
`<section>` masquées, `show(nom)` bascule de l'une à l'autre. Si une refonte
demande de découper `index.html`, garder des modules ES chargés directement par
le navigateur : aucune étape de compilation ne doit apparaître entre le dépôt
et Vercel.

---

## Ce qu'il ne faut pas casser

### 1. Le moteur est dupliqué côté serveur

`supabase/functions/_shared/game-core.js` est une copie de `game-core.js`.
`publier.bat` la resynchronise à chaque envoi. Si les deux divergent, le serveur
recalcule les scores avec des règles différentes de celles que le joueur a vues.
Après toute modification du moteur : relancer `publier.bat`, ou recopier le
fichier à la main.

### 2. Le client n'envoie jamais un score

Il envoie sa grille. L'Edge Function `supabase/functions/submit` vérifie le
jeton, assainit la grille, rejoue le scénario et écrit elle-même dans `scores`
avec la clé `service_role`. Les règles RLS n'accordent au client **aucun droit
d'insertion** sur `scores`. Ne jamais ajouter de politique d'insertion, ne
jamais faire calculer un score par le navigateur pour l'envoyer tel quel.

La clé `anon` visible dans `cloud.js` est publique par construction, c'est
normal. La clé `service_role` ne doit apparaître nulle part dans le dépôt : elle
vit uniquement dans les secrets Supabase.

### 3. Aucune dépendance externe au chargement

L'application est installable et doit fonctionner hors ligne. Pas de CDN, pas de
bibliothèque distante, pas de police chargée en bloquant le rendu. Seules les
Google Fonts sont appelées, et la page reste lisible sans elles. Si une
bibliothèque devient indispensable, elle est copiée dans le dépôt.

Conséquence pratique : l'export PDF du mode examen passe par `window.print()` et
une feuille de style `@media print`, pas par une bibliothèque PDF.

### 4. Toucher au barème invalide les scores en base

`evaluate()` définit le barème. Le modifier rend incomparables tous les scores
déjà enregistrés et oblige à recalibrer les cinq niveaux au solveur. Si c'est
nécessaire, le dire explicitement à Arthur avant, pas après.

### 5. Le service worker peut servir une version périmée

`sw.js` est en « réseau d'abord » pour le HTML et le JavaScript, précisément
pour éviter ça. Ne pas passer ces deux types en « cache d'abord ». Si la liste
`COQUILLE` change, incrémenter `CACHE` (`planningmaster-vN`).

---

## Conventions

**Bilingue.** Tous les textes vivent dans les tables `FR` et `EN` de
`index.html`, lues par `t(cle)`. Toute chaîne ajoutée doit exister dans les
deux. Aucun texte en dur dans le balisage.

**Thème clair et sombre.** Les couleurs sont des variables CSS déclarées trois
fois : `:root`, puis `@media (prefers-color-scheme: dark)`, puis
`:root[data-theme="dark"]`. Les deux blocs sombres doivent rester identiques.
Toute nouvelle couleur passe par une variable, jamais en dur dans une règle.

**Icônes.** Un sprite SVG inline en haut du `<body>`, tracé seul, `currentColor`,
`stroke-width` 1.7. On l'utilise avec `ico('nom')` côté JS ou
`<svg class="i"><use href="#i-nom"/></svg>` en HTML. Pas d'emoji dans
l'interface.

**Cibles tactiles.** 44 px de haut minimum pour tout ce qui se clique. La grille
bascule en vue « un jour à la fois » sous 700 px.

**Commentaires.** En français, au-dessus des blocs, pour expliquer *pourquoi*
plutôt que *quoi*. Plusieurs pièges du projet sont documentés directement dans
le code, notamment dans `solver.js` et `deriveNeeds()`. Ne pas les supprimer.

**Style d'écriture.** Arthur ne veut pas de tirets cadratins dans les textes de
l'interface. Deux-points, virgules ou parenthèses à la place.

---

## Les règles du jeu, en bref

Cinq types de service : repos `R`, préparation `P` (7 h), midi `M` (4 h), soir
`S` (5 h 45), coupure `C` (9 h 45, couvre midi et soir).

Contraintes légales : 11 h de repos entre deux journées, 2 jours de repos par
semaine, 48 h hebdomadaires au plafond. Heures majorées à +10 % de 36 à 39 h,
+20 % de 40 à 43 h, +50 % au-delà.

Règles optionnelles portées par `scenario.regles`, introduites progressivement
au fil des niveaux : indemnité de coupure, majoration du dimanche, jour férié
payé double, apprenti qui ne ferme jamais et plafonne à 35 h.

Score sur 100, points retirés par catégorie : `legal`, `couv`, `eco`, `conf`.

---

## Chantier proposé : le design

Le design a été repris récemment. Ce qui est en place : charte à base de
variables CSS, cases de planning colorées avec barre latérale, quatre compteurs
d'infractions au lieu d'une liste, sprite d'icônes, boutons à 44 px, vue mobile
« un jour à la fois », page d'accueil réduite à une trentaine de mots.

Ce qui mériterait encore du travail, par ordre d'intérêt :

1. **La grille en elle-même.** C'est l'écran où le joueur passe 95 % de son
   temps et il reste très proche d'un tableur. Densité, hiérarchie entre le nom
   du salarié et son compteur d'heures, lisibilité des cases signalées en
   infraction, lecture de la ligne des besoins (`KIT 2/1 · FOH 1/1` reste
   cryptique).
2. **Le débriefing de fin de semaine.** Actuellement une modale de texte. Une
   comparaison visuelle entre la grille du joueur et celle du solveur
   apprendrait bien plus.
3. **La saison.** Dix semaines qui s'enchaînent, avec fatigue et moral par
   salarié, et aucune représentation de cette évolution dans le temps.
4. **Les états vides.** Classements sans score, historique sans tentative :
   aujourd'hui une phrase grise.
5. **Les animations.** Presque aucune. Poser une case, valider une semaine,
   gagner une étoile méritent un retour visuel, en respectant
   `prefers-reduced-motion`.

Deux garde-fous pour ce chantier : le jeu doit rester lisible et jouable au
clavier sur un écran de bureau, et la vue mobile ne doit pas redevenir un
tableau à faire défiler horizontalement.
