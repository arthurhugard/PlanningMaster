# PlanningMaster

Simulateur de planning d'équipe en restauration, dans un restaurant lyonnais.
Cinq niveaux scénarisés, une saison de dix semaines où l'état de l'équipe se reporte
d'une semaine à l'autre, et un générateur de semaines à graine partageable — le tout
sous contraintes de repos, de couverture de service et de masse salariale.
Bilingue français / anglais.

**En ligne : [planningmaster.arthurhugard.com](https://planningmaster.arthurhugard.com)**
*(l'ancienne adresse jeu.arthurhugard.com redirige)*

## Le principe

On choisit un service (repos, prépa, midi, soir, coupure) et on le pose sur la grille
équipe × jours. Un moteur de contraintes recalcule à chaque coup :

| Contrôle | Règle appliquée | Malus |
|---|---|---|
| Repos quotidien | 11 h entre la fin d'un service et la reprise | −20 |
| Repos hebdomadaire | 2 jours minimum | −20 |
| Durée hebdomadaire | 48 h maximum | −20 |
| Couverture | effectif demandé par service et par pôle | −12 par poste |
| Encadrement | un responsable par pôle et par service | −8 |
| Heures perdues | heures payées mais non planifiées | −1 par heure |
| Budget | masse salariale contre objectif | jusqu'à −25 |
| Souhaits | demandes de l'équipe | −3 |

Les heures supplémentaires sont majorées à 10 % (36-39 h), 20 % (40-43 h) et 50 %
(44 h et plus), au-dessus de la durée légale de 35 h.

Les trois niveaux ont chacun au moins une solution à 100/100 : le niveau 1 se boucle
avec 109 h en cuisine et 105 h en salle, soit exactement le volume contractuel de la
brigade côté cuisine.

## Structure des shifts

| Code | Service | Horaires | Heures | Couvre |
|---|---|---|---|---|
| `R` | Repos | — | 0 | — |
| `P` | Prépa | 08:00–15:00 | 7 | midi |
| `M` | Midi | 11:00–15:00 | 4 | midi |
| `S` | Soir | 18:00–23:45 | 5,75 | soir |
| `C` | Coupure | 11:00–15:00 + 18:00–23:45 | 9,75 | midi + soir |

La combinaison piège : un `S` ou un `C` finit à 23:45, un `P` démarre à 08:00 le
lendemain. Huit heures quinze de repos au lieu des onze réglementaires.

## Technique

Une page HTML autonome, sans dépendance ni build. Tout tient dans `index.html` :
le modèle de données des niveaux, le moteur de contraintes, le rendu et les deux
langues. Les polices viennent de Google Fonts, la progression est conservée dans le
`localStorage` du navigateur.

```
index.html            le jeu
og.png                image de partage (1200×630)
favicon.svg           icône
apple-touch-icon.png  icône iOS
vercel.json           en-têtes de sécurité et de cache
```

## Développement

Aucun outillage requis. Pour servir le dossier en local :

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

### Modifier ou ajouter un niveau

Les niveaux sont décrits dans le tableau `LEVELS` d'`index.html`. Un niveau contient
les besoins par jour (`besoin`), l'équipe (`equipe`), le budget, les souhaits
(`prefs`) et, facultativement, un brouillon de départ (`draft`). La fonction
`b(cuisineMidi, salleMidi, cuisineSoir, salleSoir)` décrit les besoins d'une journée.

Après toute modification des besoins ou des contrats, vérifier qu'une solution à
100/100 existe encore : le volume horaire minimal d'un niveau vaut
`4 h × postes midi + 5,75 h × postes soir`, à comparer au total des contrats.

## Avertissement

Modèle pédagogique inspiré de la convention collective HCR et du Code du travail,
volontairement simplifié. L'équipe, les salaires et les chiffres d'affaires sont
fictifs. Ne remplace ni un conseil juridique, ni un logiciel de paie.

## Licence

MIT.
