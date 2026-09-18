# Direction artistique, PlanningMaster

Lecture du CSS de `index.html` (variables, typographie, composants), et des
trois autres surfaces de marque : `favicon.svg`, `og.png`, `site.webmanifest`.
Aucun fichier existant n'a été modifié.

---

## 1. Critique de l'état actuel

### Identité

Avant de lire un mot, le site raconte une revue ou un carnet éditorial :
serif display en gros titre, grotesque en texte courant, mono en étiquette.
C'est la signature visuelle très répandue depuis 2022 dans le SaaS indépendant
et les newsletters (le trio Fraunces/Grotesque/Mono se retrouve sur des
dizaines de sites Framer et de dashboards Linear-like). Ce n'est pas un
mauvais goût, c'est un goût *par défaut*, celui qu'on obtient en suivant les
inspirations Dribbble du moment sans les tordre pour le sujet.

Or le sujet, c'est un coup de feu de restaurant : la pression du service,
la brigade, le pass, les tickets qui s'accumulent. Rien dans la direction
actuelle ne vient de la cuisine. Elle vient de l'édition. Un joueur qui ouvre
le site s'attend à lire un article, pas à improviser un planning sous
contrainte un dimanche soir bondé.

Deux détails renforcent le décalage :

- **Le nom affiché n'est pas le nom du projet.** L'app dit `PlanningMaster`
  partout (titre, logo, manifeste). Mais `og.png`, l'image que Google et les
  réseaux sociaux montrent, dit `Planning` puis `Coup de Feu` en italique
  corail sur fond presque noir, avec une grille de cases violettes et bleu
  marine qui n'existe nulle part dans l'app réelle (fond sombre par défaut,
  palette différente, aucune de ces teintes n'apparaît dans `:root`). Le nom
  du dossier du projet est lui-même `planning-coup-de-feu`. Il y a donc trois
  identités qui coexistent sans se parler : le nom vitrine, le nom social, le
  nom de code. Ce n'est pas à cette direction artistique de trancher ce point
  (c'est une décision de produit, pas de style), mais aucune des deux pistes
  ci-dessous ne pourra donner un résultat cohérent tant qu'un seul nom n'aura
  pas été choisi. À soulever avec toi avant d'aller plus loin.
- **Le favicon ne descend d'aucun des deux.** Carré sombre, quatre cases
  colorées façon calendrier, un liseré corail sur une case. C'est un pictogramme
  d'application générique, pas un signe qui prolonge le logotype Fraunces ni
  la grille de `og.png`. Trois surfaces, trois mains.

Résultat : on sent des couches ajoutées les unes aux autres (le logotype à un
moment, l'image de partage à un autre, l'icône plus tard) plutôt qu'une
décision unique tenue jusqu'au bout.

### Typographie

Trois familles : Fraunces (titres), Archivo (texte), IBM Plex Mono (chiffres,
étiquettes). Le principe (afficher / lire / mesurer) est défendable en soi,
mais l'exécution ne va pas jusqu'au bout de son idée. Fraunces n'est utilisée
que dans son opposition droit/italique + rouge sur `<em>`, un procédé qui
revient identique sur `PlanningMaster`, le hero, `.mode .mt`, `.daily h3`,
`.lcard .lt`, le score du débrief : à force de répétition, l'italique perd sa
force de signal.

L'échelle de tailles n'est pas une échelle, c'est un nuage de valeurs : 9.5px,
10px, 10.5px, 11px, 11.5px, 12px, 12.5px, 13px, 13.5px, 14px, 14.5px, 15px,
16px, 17px, 18px, 19px, 20px, 21px, 22px, 23px, 24px, 26px, 27px, 28px, 54px.
Vingt-cinq valeurs distinctes pour du texte d'interface. Aucune ne se déduit
des autres, chaque composant a fixé la sienne au pixel près en le construisant.
Une échelle réelle (même approximative, même à 6 ou 7 paliers) forcerait des
choix de hiérarchie au lieu de les laisser dériver composant par composant.

Les chiffres tabulaires (`font-variant-numeric:tabular-nums`) sont bien
posés, c'est un des seuls réflexes systématiques du fichier. Les longueurs de
ligne sont correctement bornées (`max-width:56ch` sur le hero). Le problème
n'est pas l'exécution technique, c'est l'absence d'une raison d'avoir trois
familles plutôt qu'une hiérarchie de graisses et de tailles dans une ou deux.

### Couleur

Neuf teintes distinctes cohabitent : l'accent (rouge brique), les cinq
couleurs de service (orange midi, brun-or prépa, bleu soir, violet coupure,
gris repos), plus les trois couleurs de statut (vert ok, ambre warn, rouge
bad). Le rouge de `bad` et le rouge de `--accent` sont volontairement
proches, ce qui est correct en soi (l'accent hérite du vocabulaire d'alerte),
mais rien ne le rend perceptible : l'accent sert tour à tour de lien, de
kicker de mode, de pastille de règle, de bordure de `.brief`, sans point commun
visuel entre ces usages sinon la couleur. Un accent qui apparaît partout de la
même manière n'est pas un accent, c'est une couleur de plus.

Le vrai symptôme, et celui que tu identifies toi-même, est le contraste entre
la page qui l'entoure (vert-gris sauge, surfaces blanc cassé, bordures fines,
très retenu) et la grille remplie (cinq pastels qui se répondent en
même temps sur toute la largeur de l'écran). Ce n'est pas que les couleurs de
service soient mauvaises individuellement : `soir` et `coup` par exemple sont
bien choisies, à bonne distance de teinte. C'est que rien dans le reste de
l'interface ne les prépare. Le joueur passe d'un environnement neutre à un
tableur de bonbons sans palier intermédiaire. Une carte de niveau, un panneau,
une barre d'outils, tout reste sage jusqu'à la grille, qui explose seule.

Les couleurs de service se distinguent aujourd'hui uniquement par la teinte
(plus une pastille latérale de la même teinte, donc c'est redondant sur le même
canal). Un daltonien protanope ou deutéranope confondra `midi` (orange) et
`prep` (brun-or) sans autre indice : elles ne se distinguent en luminosité que
faiblement et sont voisines en teinte. Ce n'est pas encore un vrai problème
d'accessibilité (les codes texte `P`/`M`/`S`/`C`/`R` restent lisibles dans la
case), mais la couleur seule ne porte pas l'information, contrairement à ce
que demande le brief.

### Espacement et rythme

Même diagnostic que la typographie : des valeurs choisies au cas par cas
(`padding:7px 6px`, `9px 11px`, `11px 14px`, `13px 14px`, `16px 18px`...)
plutôt qu'un multiple d'une unité de base. Le rythme vertical global (grands
blocs séparés par `margin-bottom:22px` ou `26px`) tient à peu près, mais le
détail (le padding d'un chip, d'un panneau, d'une carte) n'obéit à aucune
règle commune. C'est ce qui fait qu'un écran donne une impression de densité
cohérente vue de loin, et de petites incohérences vues de près.

### Formes et matière

Rayon de 6px presque partout (`--radius`), bordures 1px, une ombre à deux
couches discrète et réutilisée telle quelle sur tous les éléments flottants
(carte de niveau, mode, playerbar, panel, chip). C'est un langage cohérent,
mais c'est *le* langage par défaut de n'importe quel design system de carte
blanche à bordure fine (Stripe, Notion, Linear, et leurs centaines de clones).
Rien ne le rattache à la restauration : pas de références aux tickets de
cuisine, aux ardoises, aux plannings papier scotchés au mur du pass. C'est
propre et interchangeable.

### Thème sombre

C'est le point le mieux traité du fichier. Les trois blocs (`:root`,
`prefers-color-scheme`, `[data-theme="dark"]`) sont bien synchronisés, chaque
variable est redéclarée avec une vraie valeur pensée pour le sombre (pas un
simple `filter:invert`), et les teintes de service gardent leur identité en
changeant de luminosité plutôt qu'en changeant de nature. Techniquement,
rien à reprendre ici. La seule limite est que le sombre n'est qu'une
inversion de luminosité de la même palette claire : il n'y a pas de geste
propre au mode sombre (une ambiance différente, une chaleur différente),
seulement la même histoire racontée plus foncée. Les deux pistes ci-dessous
en font quelque chose de plus intentionnel.

### Marque

Le logotype est un mot en Fraunces, la seconde syllabe en italique rouge.
C'est un traitement typographique, pas un signe : il n'existe aucune version
courte (pas de monogramme, pas de mark) utilisable seule sur un favicon, une
icône d'app ou une vignette de réseau social, alors que ces trois usages
existent déjà dans le dépôt et divergent chacun à sa manière (voir plus haut).
La marque n'a, aujourd'hui, qu'une seule taille : celle du titre.

### Cohérence d'ensemble

Le CSS lui-même est d'une seule main, exécuté proprement (les commentaires en
français sont utiles, la logique d'allègement de la grille par palier est
bien pensée). Ce qui manque n'est pas de la rigueur d'exécution, c'est un parti
pris : la direction actuelle est une bonne exécution d'un système qui n'a
jamais été choisi pour ce projet en particulier, seulement hérité de ce qui se
fait ailleurs en ce moment.

### Références

Ce à quoi le site ressemble aujourd'hui : un dashboard SaaS éditorial
générique, dans la lignée visuelle de Linear, Stripe Docs ou d'un thème Framer
« journal ». Rien de honteux, mais rien qui dise restauration, service, jeu.

Ce dont il devrait se rapprocher : le monde des tickets de commande imprimés
en cuisine, des ardoises de brigade, des plannings papier punaisés au pass,
des plaques émaillées de brasserie, éventuellement des interfaces de jeux de
gestion (*Overcooked*, *Two Point Hospital*) qui savent rester lisibles sous
tension tout en ayant un caractère graphique fort.

Ce qu'il doit éviter : l'esthétique « app de livraison grand public »
(Deliveroo, Uber Eats : rondeurs, jaune/rouge saturés, emoji) qui tirerait le
ton vers le grand public consommateur alors que le joueur est censé endosser
un rôle de manager, et l'esthétique « logiciel RH d'entreprise » (Personio,
Workday : bleu institutionnel, cartes interchangeables) qui tuerait le côté
jeu.

---

## 2. Deux directions

Les deux gardent la structure de variables CSS du fichier actuel (mêmes noms :
`--bg`, `--surface`, `--ink`, `--accent`, les paires `--midi`/`--midi-soft`,
etc.) pour rester un remplacement simple, sans toucher à la logique JS qui
consomme ces classes.

### Piste A — « Le ticket » (kraft, brigade, sang-froid)

**Intention.** Le jeu ressemble à un vrai document de service, sorti tel
quel du pass, pour que la pression d'un coup de feu se sente avant d'avoir lu
une ligne.

**Typographie.** Deux familles, pas trois, et la deuxième est déjà dans le
projet :

- Affichage (titres, logo, score, tout ce qui « s'annonce ») :
  **Big Shoulders Display**, condensée, en capitales serrées. Elle a la
  raideur d'un tampon encreur, pas la rondeur d'une revue.
- Tout le reste, y compris le texte courant : **IBM Plex Mono**, déjà
  chargée aujourd'hui. Un ticket de cuisine est tapé, pas composé : le texte
  courant en monospace n'est pas un compromis technique ici, c'est le sujet.
  Interligne desserré (1.55) et graisse 400 pour que la lecture longue (les
  briefs, les règles) reste confortable malgré la chasse fixe.

Deux familles, deux rôles nets : ce qui s'annonce, ce qui s'explique. Fini
Archivo et Fraunces.

Échelle de tailles (remplace les 25 valeurs actuelles) :
`--fs-1:11px --fs-2:13px --fs-3:15px --fs-4:16px --fs-5:20px --fs-6:26px
--fs-7:36px --fs-8:52px`.

**Palette.**

```css
:root{
  --bg:#EAE3D0; --surface:#F8F4E7; --surface-2:#EEE6D0;
  --ink:#1C1A14; --ink-2:#4B4734; --muted:#8B8367;
  --line:#D2C7A6; --line-strong:#A89B72;
  --accent:#C4351B;
  --repos:#635C46; --repos-soft:#E4DEC9;
  --prep:#7A5B12;  --prep-soft:#EEDFA8;
  --midi:#A5480F;  --midi-soft:#F3D3B4;
  --soir:#1E5A82;  --soir-soft:#C9DFEC;
  --coup:#6B3E74;  --coup-soft:#E1CFE6;
  --ok:#2E6B3B;    --ok-soft:#D2E6CE;
  --warn:#8A5A0C;  --warn-soft:#F0DFB4;
  --bad:#B23327;   --bad-soft:#F3D4CE;
  --shadow-color:rgba(28,26,20,.35);
  --shadow:3px 3px 0 var(--shadow-color);
  --radius:2px;
}
:root[data-theme="dark"]{
  --bg:#15130E; --surface:#1F1C14; --surface-2:#282319;
  --ink:#F2ECDA; --ink-2:#C7BFA3; --muted:#8F866B;
  --line:#3A3423; --line-strong:#544C33;
  --accent:#FF6A3D;
  --repos:#A79E80; --repos-soft:#2C2818;
  --prep:#D9B65A;  --prep-soft:#3B2F12;
  --midi:#E89257;  --midi-soft:#452912;
  --soir:#7FB8E0;  --soir-soft:#1B3245;
  --coup:#CB9FD1;  --coup-soft:#392A40;
  --ok:#8FD39A;    --ok-soft:#1D3320;
  --warn:#E8BE6E;  --warn-soft:#3A2C10;
  --bad:#F08979;   --bad-soft:#3F1E17;
  --shadow-color:rgba(0,0,0,.55);
}
```

Un seul accent, rouge vermillon franc, réservé aux actions primaires, au
score et au focus clavier : nulle part ailleurs. Les cinq services restent
dans leurs familles de teinte d'origine (prépa = or, midi = orange, soir =
bleu, coupure = violet, repos = gris) mais en encre soutenue sur papier plutôt
qu'en pastel, avec un contraste net vis-à-vis de l'accent.

**Espacement.** `--sp-1:4px --sp-2:8px --sp-3:12px --sp-4:16px --sp-5:24px
--sp-6:32px --sp-7:48px`. Rythme serré, densité de document administratif
assumée : le jeu n'a pas peur de ressembler à de la paperasse HCR, c'est le
sujet.

**Formes et matière.** Rayon de 2px partout, aucune courbe. Bordures 1px,
mais les séparations de section utilisent un filet pointillé
(`border-top:2px dashed var(--line-strong)`) qui cite la perforation d'un
rouleau de tickets. L'ombre n'est plus un flou : un décalage dur de 3px sans
alpha progressif, comme une pile de tickets légèrement décalés. Les coins des
blocs de titre (hero, en-tête de fiche) sont coupés en biseau via
`clip-path`, comme un coin de bon de commande arraché.

**Thème sombre.** Le pass en pleine nuit de service : charbon chaud
(`#15130E`), pas gris neutre, avec l'accent qui devient un orange sodium plus
vif (`#FF6A3D`), comme la lampe du pass. Ce n'est plus une inversion, c'est
une autre heure de la même cuisine.

**Logotype.** Le mot `PlanningMaster` (ou le nom retenu) en Big Shoulders
Display, capitales, tracking serré, encre pleine, sans italique. Devant lui,
un petit carré plein à coin coupé (le « tampon »), dans l'accent, qui sert de
mark autonome pour le favicon et l'icône d'app : un seul signe qui existe déjà
dans le logotype, pas un ajout séparé. `og.png` reprend le même fond kraft
sombre que le thème sombre de l'app, avec la vraie grille de service aux
vraies couleurs, pour que l'image partagée corresponde enfin à ce qu'on ouvre.

**Sur l'écran de jeu.** La palette d'outils devient une rangée de tampons
encreurs plutôt que de puces arrondies (coins coupés, encre pleine au survol).
La grille garde son fond clair et calme, mais les cases de service passent en
encre saturée sur fond crème au lieu de pastel sur blanc : le contraste avec
le reste de l'écran diminue puisque le reste de l'écran est déjà crème, pas
blanc. Une case en infraction n'ajoute plus seulement un liseré rouge : elle
reçoit un petit motif de hachures diagonales dans le coin, un deuxième canal
que la couleur seule, utile aussi en sombre.

---

### Piste B — « La brigade » (tactile, chaleureux, atelier)

**Intention.** Le jeu ressemble au tableau de service affiché en cuisine
avant le coup de feu, avec ses jetons et ses aimants, chaleureux et
manipulable, pour donner envie d'y revenir chaque semaine comme à un rituel
d'équipe plutôt que de le subir comme un tableur.

**Typographie.** Trois familles, mais chacune avec un rôle qui ne se recouvre
jamais, à l'inverse de l'existant où Fraunces sert à la fois de logo, de
titre de carte et de score :

- Affichage et voix de la marque (logo, titres d'écran, score) :
  **Bricolage Grotesque**, graisse 600-800. Un grotesque à forte personnalité,
  pas un serif éditorial : plus proche d'une enseigne peinte à la main que
  d'une revue.
- Texte courant (descriptions, briefs, règles) : **Karla**, 400-600. Chaleureuse,
  lisible, sans lien de famille avec Bricolage : le contraste entre les deux
  crée la hiérarchie, pas la taille seule.
- Données et étiquettes (heures, scores en table, codes de service) :
  **Space Mono**. Registre légèrement plus rond et moins clinique que Plex,
  cohérent avec un fond chaleureux plutôt qu'un fond neutre.

Échelle : `--fs-1:11px --fs-2:13px --fs-3:15px --fs-4:16px --fs-5:19px
--fs-6:24px --fs-7:34px --fs-8:50px`.

**Palette.**

```css
:root{
  --bg:#EFE5D8; --surface:#FBF6EC; --surface-2:#F2E8D9;
  --ink:#2B2019; --ink-2:#5C4C3E; --muted:#8B7A68;
  --line:#E1D3C0; --line-strong:#C7B196;
  --accent:#B5652B;
  --repos:#5F6B69; --repos-soft:#E2E7E5;
  --prep:#93720C;  --prep-soft:#F1E2AE;
  --midi:#B85423;  --midi-soft:#F5D8BE;
  --soir:#1F6B78;  --soir-soft:#CEE6E6;
  --coup:#7A4A82;  --coup-soft:#E7D6EA;
  --ok:#3D7A48;    --ok-soft:#DCEBD8;
  --warn:#9C7412;  --warn-soft:#F2E2B0;
  --bad:#AE3A2E;   --bad-soft:#F2D7D1;
  --shadow:inset 0 1px 0 rgba(255,255,255,.6),
           0 1px 2px rgba(43,32,25,.08),
           0 10px 22px -12px rgba(43,32,25,.28);
  --radius:16px; --radius-pill:999px;
}
:root[data-theme="dark"]{
  --bg:#1E160F; --surface:#2A2018; --surface-2:#332721;
  --ink:#F3E9DC; --ink-2:#CBB9A4; --muted:#8F7A64;
  --line:#4A392B; --line-strong:#67503A;
  --accent:#E08A46;
  --repos:#96A19E; --repos-soft:#2B322F;
  --prep:#D8B65C;  --prep-soft:#3B2F14;
  --midi:#E0895A;  --midi-soft:#4A2E17;
  --soir:#6FB6C0;  --soir-soft:#1D373A;
  --coup:#C9A0CE;  --coup-soft:#392A3E;
  --ok:#8FCB93;    --ok-soft:#22331F;
  --warn:#E4BE73;  --warn-soft:#392C11;
  --bad:#EF9384;   --bad-soft:#3E1E18;
  --shadow:inset 0 1px 0 rgba(255,255,255,.06),
           0 1px 2px rgba(0,0,0,.4),
           0 12px 26px -14px rgba(0,0,0,.6);
}
```

Le soir passe du bleu marine au bleu-vert (pour laisser le bleu à la
cohérence globale et éviter que cinq couleurs se battent avec un accent
cuivré), la prépa passe au jaune-brun plus franc. Chaque service garde un
écart de teinte d'au moins 30° avec ses voisins sur le cercle chromatique et
un écart de clarté suffisant pour rester distinguable en simulation de
daltonisme, en plus des icônes déjà présentes dans le sprite qui portent
l'information sur un second canal.

**Espacement.** `--sp-1:4px --sp-2:8px --sp-3:14px --sp-4:20px --sp-5:28px
--sp-6:40px --sp-7:56px`. Plus aéré que la piste A : c'est la respiration qui
fait la différence entre un objet qu'on manipule avec plaisir et un document
qu'on remplit vite.

**Formes et matière.** Rayon de 16px sur les cartes, pilule pleine sur les
chips et les boutons secondaires : la carte de niveau, la case de la grille,
le chip de service ressemblent à des jetons ou des aimants émaillés plutôt
qu'à des cellules de tableur. L'ombre gagne un lisére clair en haut
(`inset 0 1px 0 rgba(255,255,255,.6)`) qui simule un bord émaillé légèrement
bombé, en plus de l'ombre portée existante, pour une matière plus épaisse que
la carte blanche plate actuelle.

**Thème sombre.** La veillée, four éteint mais encore tiède : brun presque
noir plutôt que le gris-bleu habituel des thèmes sombres, accent cuivré qui
devient une lueur plus chaude (`#E08A46`). Contrairement à la piste A (froide,
métallique la nuit), la piste B reste chaude à toute heure : c'est le signal
qui distingue le plus les deux directions en sombre.

**Logotype.** Un jeton rond façon pin's émaillé (couleur `--accent`, icône
toque du sprite existant, léger biseau via `--shadow`) posé à gauche du mot
`Planning` en Bricolage Grotesque 700, sans italique. En dessous, en petite
capitale Space Mono, le sous-titre `COUP DE FEU` peut porter le second nom du
projet sans que les deux se disputent la même ligne. `og.png` reprend ce
jeton en grand format sur le fond `--bg` sombre, avec la vraie grille de
service : la vignette de partage devient un aperçu fidèle du jeu, pas un
visuel à part.

**Sur l'écran de jeu.** La barre d'outils devient une rangée de jetons
ronds colorés, plus proches de pièces de jeu de plateau que de puces de
formulaire. La grille garde des cases arrondies (8px) avec le même bord
émaillé que les cartes : poser un service ressemble à poser un aimant sur un
tableau, pas à cocher une case. Le tableau de bord de fin de semaine gagne des
jauges à bords ronds et un score en Bricolage Grotesque très grand, plus
proche d'un score de jeu de plateau familial que d'un chiffre de reporting.

---

## 3. Pour comparer

`design/piste-a.html` et `design/piste-b.html` appliquent chacun le système
ci-dessus à : le bloc titre avec logo, une carte de niveau complète, la
palette des cinq services, six lignes de grille remplies avec une case en
infraction, le tableau de bord de fin de semaine (score, rang, quatre
compteurs), et les boutons primaire/secondaire. Un bouton en haut de chaque
page bascule entre clair et sombre (même mécanisme que l'app réelle,
`data-theme` sur `<html>`, avec repli sur `prefers-color-scheme`).

Aucune des deux ne redessine les parcours, la densité d'information ou la
lisibilité des libellés (`KIT 2/1 · FOH 1/1` reste tel quel) : ce chantier-là
est pour une prochaine fois, une fois le système visuel choisi.
