/* =====================================================================
   PlanningMaster, moteur de jeu
   Aucune dépendance au DOM ni à la langue : ce module tourne à l'identique
   dans le navigateur et dans l'Edge Function Supabase qui revalide les
   scores. Les infractions sortent sous forme de codes, l'interface les
   traduit. Ne rien ajouter ici qui touche à l'affichage.
   ===================================================================== */
const SHIFTS = {
  R:{code:'R',h:0,   deb:null,fin:null, couvre:[],              col:'--repos',label:''},
  P:{code:'P',h:7,   deb:8,   fin:15,   couvre:['midi'],        col:'--prep', label:'08:00–15:00'},
  M:{code:'M',h:4,   deb:11,  fin:15,   couvre:['midi'],        col:'--midi', label:'11:00–15:00'},
  S:{code:'S',h:5.75,deb:18,  fin:23.75,couvre:['soir'],        col:'--soir', label:'18:00–23:45'},
  C:{code:'C',h:9.75,deb:11,  fin:23.75,couvre:['midi','soir'], col:'--coup', label:'11:00–15:00 + 18:00–23:45'},
};
const ORDER=['R','P','M','S','C'], KEYMAP={'0':'R','1':'P','2':'M','3':'S','4':'C'};

function coutSalarie(em,h){
  const p=Math.max(h,em.contrat), tx=em.taux;
  let c=Math.min(p,35)*tx;
  if(p>35)c+=(Math.min(p,39)-35)*tx*1.10;
  if(p>39)c+=(Math.min(p,43)-39)*tx*1.20;
  if(p>43)c+=(p-43)*tx*1.50;
  return c;
}

/* ---------------------------------------------------------------------
   Règles optionnelles. Chaque scénario porte un objet `regles` : les
   niveaux les introduisent une par une, le générateur les active selon
   la difficulté. Absent = aucune, ce qui laisse le moteur identique à
   sa version d'origine.

     coupure   indemnité forfaitaire pour chaque journée en deux fois
     dimanche  majoration des heures du dimanche
     ferie     majoration des heures d'un jour férié
     apprenti  un apprenti ne ferme pas et reste sous 35 h
   --------------------------------------------------------------------- */
const RULES_ORDER = ['coupure','dimanche','ferie','apprenti'];
const COUPURE_EUR = 8;      // indemnité de coupure, forfait par journée coupée
const MAJO_DIM    = 0.20;   // +20 % sur les heures du dimanche
const MAJO_FERIE  = 1.00;   // +100 % sur les heures d'un jour férié

/* Majorations et indemnités d'un salarié sur la semaine, en euros.
   Elles portent sur les heures réellement travaillées, alors que le
   salaire de base porte sur le contrat : un salarié sous son contrat
   est payé pareil, mais ne déclenche aucune majoration. */
function supplements(S,em,row){
  const R=S.regles||{};
  let sup=0;
  row.forEach((c,d)=>{
    const sh=SHIFTS[c];
    if(!sh.h) return;
    let m=0;
    if(R.dimanche && d===6) m+=MAJO_DIM;
    if(R.ferie && S.jours[d] && S.jours[d].note==='ferie') m+=MAJO_FERIE;
    if(m) sup+=sh.h*em.taux*m;
    if(R.coupure && c==='C') sup+=COUPURE_EUR;
  });
  return sup;
}

function evaluate(S,p){
  const issues=[],flags=new Set(),hours={},cost={};
  const R=S.regles||{};
  let total=0;
  S.equipe.forEach(em=>{
    const row=p[em.id];
    let h=0,repos=0;
    row.forEach(c=>{h+=SHIFTS[c].h; if(c==='R')repos++;});
    hours[em.id]=h; cost[em.id]=coutSalarie(em,h)+supplements(S,em,row); total+=cost[em.id];
    if(R.apprenti&&em.appr){
      const soirs=[];
      row.forEach((c,d)=>{ if(c==='S'||c==='C') soirs.push(d); });
      if(soirs.length){
        issues.push({cat:'legal',pts:Math.min(20,8*soirs.length),
          code:'APPR_SOIR',a:{nom:em.nom,n:soirs.length}});
        soirs.forEach(d=>flags.add(em.id+'-'+d));
      }
      if(h>35.01){
        issues.push({cat:'legal',pts:12,code:'APPR_H',a:{nom:em.nom,h}});
        row.forEach((c,d)=>{if(c!=='R')flags.add(em.id+'-'+d);});
      }
    }
    for(let d=0;d<6;d++){
      const a=SHIFTS[row[d]],n=SHIFTS[row[d+1]];
      if(a.fin===null||n.deb===null)continue;
      const rep=(n.deb+24)-a.fin;
      if(rep<11){
        issues.push({cat:'legal',pts:20,code:'REST',a:{nom:em.nom,h:rep,d1:d,d2:d+1}});
        flags.add(em.id+'-'+d); flags.add(em.id+'-'+(d+1));
      }
    }
    if(repos<2){
      issues.push({cat:'legal',pts:20,code:'OFF',a:{nom:em.nom,repos}});
      row.forEach((c,d)=>{if(c!=='R')flags.add(em.id+'-'+d);});
    }
    if(S.reposConsecutifs&&repos>=2){
      let ok=false;
      for(let d=0;d<6;d++) if(row[d]==='R'&&row[d+1]==='R') ok=true;
      if(!ok) issues.push({cat:'conf',pts:5,code:'CONSEC',a:{nom:em.nom}});
    }
    if(h>48){
      issues.push({cat:'legal',pts:20,code:'MAX48',a:{nom:em.nom,h}});
      row.forEach((c,d)=>{if(c!=='R')flags.add(em.id+'-'+d);});
    }
    const dispo=S.jours.filter((j,d)=>!j.ferme&&!(em.indispo&&em.indispo[d]!==undefined)).length;
    if(h<em.contrat-0.01&&dispo>0){
      const perdu=em.contrat-h;
      issues.push({cat:'eco',pts:Math.min(10,Math.round(perdu)),
        code:'PAID',a:{nom:em.nom,perdu,contrat:em.contrat,h}});
    }
  });
  let postesOK=0,postesTot=0;
  S.jours.forEach((j,d)=>{
    ['midi','soir'].forEach(sv=>{
      ['cuisine','salle'].forEach(pole=>{
        const need=j.besoin[sv][pole];
        if(need<=0)return;
        postesTot+=need;
        const pres=S.equipe.filter(em=>em.pole===pole&&SHIFTS[p[em.id][d]].couvre.includes(sv));
        postesOK+=Math.min(pres.length,need);
        if(pres.length<need){
          const m=need-pres.length;
          issues.push({cat:'couv',pts:12*m,code:'COVER',
            a:{jour:d,sv,pole,manque:m,present:pres.length,need}});
        }
        if(pres.length>0&&!pres.some(em=>em.resp))
          issues.push({cat:'couv',pts:8,code:'LEAD',a:{jour:d,sv,pole}});
      });
    });
  });
  (S.prefs||[]).forEach(pr=>{
    if(p[pr.emp]&&p[pr.emp][pr.jour]!==pr.veut)
      issues.push({cat:'conf',pts:3,code:'WISH',a:{txt:pr.txt}});
  });
  const over=total-S.budget;
  if(over>0){
    const pct=over/S.budget*100;
    issues.push({cat:'eco',pts:Math.min(25,Math.round(pct*1.5)),
      code:'BUDGET',a:{over,total,budget:S.budget}});
  }
  const score=Math.max(0,100-issues.reduce((s,i)=>s+i.pts,0));
  return {issues,flags,hours,cost,total,score,postesOK,postesTot};
}

/* ======================= données ======================= */
const b=(cm,cs,sm,ss)=>({midi:{cuisine:cm,salle:cs},soir:{cuisine:sm,salle:ss}});
function e(id,nom,pole,role,contrat,taux,resp,opts){
  return Object.assign({id,nom,pole,role,contrat,taux,resp:!!resp},opts||{});
}
const wish=(fr,en)=>({fr,en});

const LEVELS=[
{ id:'l1', n:{fr:'Niveau 1',en:'Level 1'},
  titre:{fr:'Novembre, semaine calme',en:'November, a quiet week'},
  sous:{fr:'6 salariés · fermé le lundi',en:'6 staff · closed Mondays'},
  brief:{fr:"Basse saison à Bayeux. Fermé le lundi et le dimanche soir. L'équipe est au complet et les besoins sont modestes : le vrai enjeu, c'est de coller aux contrats sans payer d'heures dans le vide. Léa a cours le mardi et le mercredi.",
    en:"Low season in Bayeux. Closed Mondays and Sunday evenings. The team is complete and demand is modest: the real challenge is matching the contracts without paying for hours nobody works. Léa has classes on Tuesday and Wednesday."},
  ca:12500,budget:4100,reposConsecutifs:false,regles:{},
  jours:[{ferme:true,besoin:b(0,0,0,0),note:'ferme'},{besoin:b(1,1,2,2)},{besoin:b(1,1,2,2)},
    {besoin:b(2,1,2,2)},{besoin:b(2,2,3,3)},{besoin:b(2,2,3,3)},{besoin:b(2,2,0,0),note:'soirFerme'}],
  equipe:[e('c1','Marc Lefèvre','cuisine','chef',39,24,true),
    e('c2','Inès Diallo','cuisine','second',35,19,true),
    e('c3','Tom Berger','cuisine','commis',35,15,false),
    e('s1','Claire Aubert','salle','mh',39,21,true),
    e('s2','Yanis Roux','salle','rangM',35,16.5,true),
    e('s3','Léa Marchand','salle','serveuse',24,15.5,false,{indispo:{1:'cours',2:'cours'}})],
  prefs:[{emp:'s2',jour:6,veut:'R',txt:wish("Yanis a demandé son dimanche","Yanis asked for Sunday off")}],
  draft:{c1:['R','C','S','P','C','C','R'],c2:['R','R','C','C','C','S','R'],
    c3:['R','S','R','C','S','C','M'],s1:['R','C','S','R','C','C','M'],
    s2:['R','S','C','C','S','S','R'],s3:['R','R','R','S','C','C','M']} },

{ id:'l2', n:{fr:'Niveau 2',en:'Level 2'},
  titre:{fr:'Le pont du 8 mai',en:'The May bank holiday'},
  sous:{fr:'8 salariés · ouvert 7 jours',en:'8 staff · open all week'},
  brief:{fr:"Premier coup de chaud de l'année : ouvert tous les jours, le 8 mai tombe un jeudi et les tables du soir sont pleines. Inès a posé ses congés vendredi et samedi, les deux services où vous auriez le plus besoin d'elle. Hugo est en contrat d'extra 20 h. Nouveauté : les heures du 8 mai sont payées double et chaque journée en coupure ouvre droit à une indemnité.",
    en:"The first rush of the year: open every day, the holiday falls on Thursday and every dinner table is booked. Inès has taken leave on Friday and Saturday, the two services where you need her most. Hugo is on a 20-hour casual contract. New this level: hours worked on the holiday are paid double, and every split day carries an allowance."},
  ca:18500,budget:6000,reposConsecutifs:false,regles:{coupure:true,ferie:true},
  jours:[{besoin:b(1,1,2,2)},{besoin:b(1,1,2,2)},{besoin:b(2,2,2,2)},{besoin:b(2,2,3,3),note:'ferie'},
    {besoin:b(2,2,3,2)},{besoin:b(2,2,3,3)},{besoin:b(2,2,0,0),note:'soirFerme'}],
  equipe:[e('c1','Marc Lefèvre','cuisine','chef',39,24,true),
    e('c2','Inès Diallo','cuisine','second',35,19,true,{indispo:{4:'conge',5:'conge'}}),
    e('c3','Tom Berger','cuisine','commis',35,15,false),
    e('c4','Hugo Pellerin','cuisine','extra',20,16,false),
    e('s1','Claire Aubert','salle','mh',39,21,true),
    e('s4','Nora Benali','salle','rang',30,17,true),
    e('s2','Yanis Roux','salle','rangM',35,16.5,true),
    e('s3','Léa Marchand','salle','serveuse',24,15.5,false,{indispo:{1:'cours'}})],
  prefs:[{emp:'s2',jour:6,veut:'R',txt:wish("Yanis a demandé son dimanche","Yanis asked for Sunday off")},
    {emp:'c3',jour:1,veut:'R',txt:wish("Tom ne peut pas fermer le mardi","Tom cannot close on Tuesday")}] },

{ id:'l3', n:{fr:'Niveau 3',en:'Level 3'},
  titre:{fr:'Plein été, semaine du 6 juin',en:'High summer, D-Day week'},
  sous:{fr:'10 salariés · budget sous tension',en:'10 staff · budget under pressure'},
  brief:{fr:"Les commémorations remplissent Bayeux, la salle tourne midi et soir sept jours sur sept. Tom est en arrêt jusqu'à mercredi inclus. Le budget est calé sur 31 % du chiffre d'affaires. Règle maison ce mois-ci : deux jours de repos consécutifs pour tout le monde.",
    en:"The commemorations fill Bayeux and the dining room turns over at lunch and dinner, seven days a week. Tom is on sick leave through Wednesday. Payroll is capped at 31% of revenue. House rule this month: two consecutive days off for everyone."},
  ca:21800,budget:6800,reposConsecutifs:true,regles:{coupure:true,dimanche:true},
  jours:[{besoin:b(2,2,2,2)},{besoin:b(2,2,2,2)},{besoin:b(2,2,3,3)},{besoin:b(2,2,3,3)},
    {besoin:b(3,3,3,3)},{besoin:b(3,3,4,4)},{besoin:b(3,3,2,2)}],
  equipe:[e('c1','Marc Lefèvre','cuisine','chef',39,24,true),
    e('c2','Inès Diallo','cuisine','second',35,19,true),
    e('c3','Tom Berger','cuisine','commis',35,15,false,{indispo:{0:'arret',1:'arret',2:'arret'}}),
    e('c4','Hugo Pellerin','cuisine','cuisinier',35,16,false),
    e('c5','Sami Ouaddah','cuisine','plongeur',24,15,false),
    e('s1','Claire Aubert','salle','mh',39,21,true),
    e('s4','Nora Benali','salle','rang',30,17,true),
    e('s2','Yanis Roux','salle','rangM',35,16.5,true),
    e('s5','Emma Caron','salle','rang',35,16.5,true),
    e('s3','Léa Marchand','salle','serveuse',24,15.5,false,{indispo:{3:'cours'}})],
  prefs:[{emp:'s2',jour:6,veut:'R',txt:wish("Yanis a demandé son dimanche","Yanis asked for Sunday off")},
    {emp:'c5',jour:0,veut:'R',txt:wish("Sami a un rendez-vous lundi","Sami has an appointment on Monday")},
    {emp:'s5',jour:2,veut:'R',txt:wish("Emma a demandé son mercredi","Emma asked for Wednesday off")}] },

{ id:'l4', n:{fr:'Niveau 4',en:'Level 4'},
  titre:{fr:'Réouverture après travaux',en:'Reopening after the works'},
  sous:{fr:'8 salariés · 5 jours, tout en soirée',en:'8 staff · 5 days, dinner-heavy'},
  brief:{fr:"La salle a été refaite, vous rouvrez le mercredi. Deux jours de fermeture en début de semaine, puis cinq services du soir pleins à craquer : tout le monde veut voir la nouvelle déco. Aucun salarié en congé, mais des besoins du soir que la brigade ne peut couvrir qu'en coupures bien placées.",
    en:"The dining room has been redone and you reopen on Wednesday. Two closed days, then five packed dinner services: everyone wants to see the new look. Nobody is on leave, but the dinner headcount can only be met with well-placed splits."},
  ca:17800,budget:5730,reposConsecutifs:false,regles:{coupure:true,dimanche:true},
  jours:[{ferme:true,besoin:b(0,0,0,0),note:'ferme'},{ferme:true,besoin:b(0,0,0,0),note:'ferme'},
    {besoin:b(2,2,3,3)},{besoin:b(2,2,3,3)},{besoin:b(3,3,4,4)},{besoin:b(3,3,4,4)},{besoin:b(3,3,2,2)}],
  equipe:[e('c1','Marc Lefèvre','cuisine','chef',39,24,true),
    e('c2','Inès Diallo','cuisine','second',35,19,true),
    e('c3','Tom Berger','cuisine','commis',35,15,false),
    e('c4','Hugo Pellerin','cuisine','cuisinier',35,16,false),
    e('s1','Claire Aubert','salle','mh',39,21,true),
    e('s4','Nora Benali','salle','rang',35,17,true),
    e('s2','Yanis Roux','salle','rangM',35,16.5,true),
    e('s5','Emma Caron','salle','rang',35,16.5,true)],
  prefs:[{emp:'c3',jour:6,veut:'R',txt:wish("Tom voudrait son dimanche","Tom would like Sunday off")}] },

{ id:'l5', n:{fr:'Niveau 5',en:'Level 5'},
  titre:{fr:'La semaine de Noël',en:'Christmas week'},
  sous:{fr:'10 salariés · tout le monde veut partir',en:'10 staff · everyone wants time off'},
  brief:{fr:"Six jours d'ouverture, fermé le 25. Les réservations du soir sont complètes depuis novembre et la moitié de l'équipe a de la famille à voir. Quatre souhaits sur la table, un budget calé à 28 % du CA, et personne à qui refuser deux fois. Louis, l'apprenti, ne ferme jamais et plafonne à 35 h : sa place est au midi. Bon courage.",
    en:"Six days open, closed on the 25th. Dinner has been fully booked since November and half the team has family to see. Four requests on the table, payroll capped at 28% of revenue, and nobody you can turn down twice. Louis, the apprentice, never closes and is capped at 35 hours: his place is at lunch. Good luck."},
  ca:25000,budget:7150,reposConsecutifs:false,regles:{coupure:true,dimanche:true,ferie:true,apprenti:true},
  jours:[{besoin:b(2,2,3,3)},{besoin:b(2,2,3,3)},{ferme:true,besoin:b(0,0,0,0),note:'noel'},
    {besoin:b(3,3,4,4)},{besoin:b(3,3,4,4)},{besoin:b(3,3,4,4)},{besoin:b(2,2,3,3)}],
  equipe:[e('c1','Marc Lefèvre','cuisine','chef',39,24,true),
    e('c2','Inès Diallo','cuisine','second',35,19,true),
    e('c3','Tom Berger','cuisine','commis',35,15,false),
    e('c4','Hugo Pellerin','cuisine','cuisinier',35,16,false),
    e('c5','Sami Ouaddah','cuisine','plongeur',35,15,false),
    e('s1','Claire Aubert','salle','mh',39,21,true),
    e('s4','Nora Benali','salle','rang',35,17,true),
    e('s2','Yanis Roux','salle','rangM',35,16.5,true),
    e('s5','Emma Caron','salle','rang',35,16.5,true),
    e('s3','Léa Marchand','salle','serveuse',35,15.5,false),
    e('a1','Louis Février','salle','apprenti',35,8.5,false,{appr:true})],
  prefs:[{emp:'s3',jour:0,veut:'R',txt:wish("Léa part en famille le lundi","Léa travels to family on Monday")},
    {emp:'c5',jour:6,veut:'R',txt:wish("Sami a demandé son dimanche","Sami asked for Sunday off")},
    {emp:'s5',jour:1,veut:'R',txt:wish("Emma voudrait le 24 au soir","Emma would like Christmas Eve off")},
    {emp:'c3',jour:3,veut:'R',txt:wish("Tom a un train le jeudi","Tom has a train on Thursday")}] },
];

/* ---------- saison ---------- */
const SEASON_TEAM=[
  e('c1','Marc Lefèvre','cuisine','chef',39,24,true),
  e('c2','Inès Diallo','cuisine','second',35,19,true),
  e('c3','Tom Berger','cuisine','commis',35,15,false),
  e('c4','Hugo Pellerin','cuisine','cuisinier',35,16,false),
  e('c5','Sami Ouaddah','cuisine','plongeur',30,15,false),
  e('s1','Claire Aubert','salle','mh',39,21,true),
  e('s4','Nora Benali','salle','rang',35,17,true),
  e('s2','Yanis Roux','salle','rangM',35,16.5,true),
  e('s5','Emma Caron','salle','rang',35,16.5,true),
  e('s3','Léa Marchand','salle','serveuse',30,15.5,false),
  e('a1','Louis Février','salle','apprenti',35,8.5,false,{appr:true}),
];
const SEASON_WEEKS=[
 {nom:{fr:"Mars, reprise",en:"March, back open"},ca:13000,mult:.62,
  txt:{fr:"On rouvre après la coupure d'hiver. Peu de monde en semaine, un peu de passage le week-end. Semaine idéale pour caler les contrats sans creuser la trésorerie.",
       en:"Reopening after the winter break. Quiet midweek, a little weekend trade. A good week to settle into the contracts without burning cash."},
  ferme:[0], staff:['c1','c2','c3','s1','s4','s2']},
 {nom:{fr:"Mars, premiers cars",en:"March, first coaches"},ca:14500,mult:.68,
  txt:{fr:"Les premiers autocars de touristes s'arrêtent à Bayeux. Les midis se remplissent, les soirs restent calmes.",
       en:"The first tourist coaches stop in Bayeux. Lunches fill up, evenings stay quiet."},
  ferme:[0], staff:['c1','c2','c3','s1','s4','s2']},
 {nom:{fr:"Avril, vacances de Pâques",en:"April, Easter holidays"},ca:17000,mult:.80,
  txt:{fr:"Vacances scolaires : familles au déjeuner, couples le soir. Vous ouvrez sept jours sur sept à partir de maintenant.",
       en:"School holidays: families at lunch, couples at dinner. You are open seven days a week from now on."},
  ferme:[], staff:['c1','c2','c3','c4','s1','s4','s2','s5']},
 {nom:{fr:"Avril, creux",en:"April, the dip"},ca:14000,mult:.66,
  txt:{fr:"Fin des vacances, la fréquentation retombe d'un coup. Profitez-en pour faire souffler ceux qui ont tiré.",
       en:"Holidays over, footfall drops sharply. Use it to rest whoever has been pushing hardest."},
  ferme:[0], staff:['c1','c2','c3','s1','s4','s2']},
 {nom:{fr:"Mai, le pont",en:"May, bank holiday"},ca:19000,mult:.88,
  txt:{fr:"Long week-end férié, la ville est pleine. Trois services du soir à quatre en cuisine.",
       en:"A long weekend and the town is full. Three dinner services need four in the kitchen."},
  ferme:[], staff:['c1','c2','c3','c4','s1','s4','s2','s5']},
 {nom:{fr:"Mai, mariages",en:"May, wedding season"},ca:18000,mult:.84,
  txt:{fr:"Deux mariages en ville : les samedis sont saturés, le reste de la semaine respire.",
       en:"Two weddings in town: Saturdays are packed, the rest of the week breathes."},
  ferme:[], staff:['c1','c2','c3','c4','s1','s4','s2','s5']},
 {nom:{fr:"Juin, le 6",en:"June, the 6th"},ca:22000,mult:1.0,
  txt:{fr:"Commémorations du Débarquement. La semaine la plus dense de la saison, midi et soir, tous les jours.",
       en:"D-Day commemorations. The busiest week of the season, lunch and dinner, every day."},
  ferme:[], staff:['c1','c2','c3','c4','c5','s1','s4','s2','s5','s3','a1']},
 {nom:{fr:"Juin, après la vague",en:"June, after the wave"},ca:18500,mult:.86,
  txt:{fr:"La ville se vide un peu. L'équipe, elle, sort de la semaine la plus dure de l'année.",
       en:"The town empties a little. The team, on the other hand, is coming off the hardest week of the year."},
  ferme:[], staff:['c1','c2','c3','c4','c5','s1','s4','s2','s5','s3','a1']},
 {nom:{fr:"Juillet, plein été",en:"July, high summer"},ca:21000,mult:.96,
  txt:{fr:"Saison pleine et stable. C'est le moment où les compteurs d'heures explosent si vous n'avez rien anticipé.",
       en:"Full, steady season. This is when the overtime banks blow up if you haven't planned ahead."},
  ferme:[], staff:['c1','c2','c3','c4','c5','s1','s4','s2','s5','s3','a1']},
 {nom:{fr:"Juillet, le 14",en:"July, Bastille Day"},ca:23000,mult:1.05,
  txt:{fr:"Dernière semaine de la campagne, et la plus chargée. Terminez sans casser personne.",
       en:"Final week of the campaign, and the heaviest. Finish without breaking anyone."},
  ferme:[], staff:['c1','c2','c3','c4','c5','s1','s4','s2','s5','s3','a1']},
];
const SEASON_EVENTS={
  2:{emp:'c2',motif:'conge',jours:[4,5]},
  5:{emp:'s5',motif:'conge',jours:[1,2]},
  7:{emp:'c4',motif:'conge',jours:[0,1,2]},
};
const SEASON_WISHES={
  1:[{emp:'s2',jour:6,txt:wish("Yanis a demandé son dimanche","Yanis asked for Sunday off")}],
  3:[{emp:'c3',jour:0,txt:wish("Tom a un rendez-vous lundi","Tom has an appointment on Monday")}],
  4:[{emp:'s5',jour:2,txt:wish("Emma a demandé son mercredi","Emma asked for Wednesday off")}],
  6:[{emp:'c3',jour:3,txt:wish("Tom voudrait son jeudi","Tom would like Thursday off")},
     {emp:'s2',jour:6,txt:wish("Yanis redemande son dimanche","Yanis asks again for Sunday off")}],
  8:[{emp:'s3',jour:5,txt:wish("Léa a un examen samedi","Léa has an exam on Saturday")}],
  9:[{emp:'s1',jour:0,txt:wish("Claire pose son lundi","Claire is taking Monday off")}],
};
const MARGE_BRUTE=0.34;  // part du CA restant pour la masse salariale (après matières et charges fixes)

// Les besoins de la semaine sont dérivés de l'effectif réellement présent :
// le volume horaire demandé colle aux contrats, donc chaque semaine reste jouable.
function deriveNeeds(equipe,W){
  const open=[];
  for(let d=0;d<7;d++) if(!W.ferme.includes(d)) open.push(d);
  const dimSoirFerme = W.mult<0.80 && open.includes(6);
  const needs={};
  ['cuisine','salle'].forEach(pole=>{
    const gens=equipe.filter(x=>x.pole===pole);
    // Un salarié en arrêt ou en congé complet ne compte pas dans la demande :
    // sinon la semaine réclame des heures que personne ne peut faire, et
    // l'arrêt d'une seule personne rend la semaine impossible à couvrir.
    const presents=gens.filter(x=>open.some(d=>!(x.indispo&&x.indispo[d]!==undefined)));
    const target=presents.reduce((s,x)=>s+x.contrat,0);
    // Un service ne peut pas demander plus de têtes que le pôle n'en compte
    // ce jour-là. Sans ce plafond, un dimanche midi seul pouvait réclamer
    // cinq personnes à une brigade de trois.
    const capJour=d=>gens.filter(em=>!(em.indispo&&em.indispo[d]!==undefined)).length;
    const w={}; let tot=0;
    open.forEach(d=>{ const v=(d>=4?1.35:1)*(d===6?0.85:1); w[d]=v; tot+=v; });
    needs[pole]={};
    open.forEach(d=>{
      const dayH=target*w[d]/tot;
      const cj=Math.max(1,capJour(d));
      if(d===6&&dimSoirFerme){
        // midi seul : on ne dépasse pas ce qu'une brigade peut aligner d'un coup
        needs[pole][d]={m:Math.min(cj,Math.max(1,Math.round(dayH/7))),s:0};
        return;
      }
      const m=Math.min(cj,Math.max(1,Math.round(dayH*0.30/4)));
      const s=Math.min(cj,Math.max(1,Math.round((dayH-4*m)/5.75)));
      needs[pole][d]={m,s};
    });
    // rattrapage : les arrondis journaliers font perdre des heures, or un volume
    // inférieur aux contrats se paie en heures payées non travaillées.
    const vol=()=>open.reduce((a,d)=>a+needs[pole][d].m*4+needs[pole][d].s*5.75,0);
    const order=open.slice().sort((a,c)=>w[c]-w[a]);
    let guard=0;
    while(target-vol()>=2 && guard++<40){
      const d=order.find(x=>{
        const n=needs[pole][x], cj=Math.max(1,capJour(x));
        if(x===6&&dimSoirFerme) return n.m<cj;
        return n.s<cj||n.m<cj;
      });
      if(d===undefined) break;
      const n=needs[pole][d], cj=Math.max(1,capJour(d));
      if(target-vol()>=5.75 && !(d===6&&dimSoirFerme) && n.s<cj) n.s++;
      else if(n.m<cj) n.m++;
      else if(n.s<cj) n.s++;
      order.push(order.shift());
    }
    guard=0;
    while(vol()-target>=5 && guard++<40){
      const d=order.find(x=>needs[pole][x].s>1)||order.find(x=>needs[pole][x].m>1);
      if(d===undefined) break;
      if(needs[pole][d].s>1) needs[pole][d].s--; else needs[pole][d].m--;
      order.push(order.shift());
    }

    // Contrainte de forme, et non plus de volume : une personne ne couvre
    // qu'un jour à la fois. Le nombre de têtes distinctes exigées un jour
    // donné vaut max(midi, soir) ; la somme sur la semaine ne peut pas
    // dépasser l'effectif multiplié par cinq jours ouvrables, sinon la
    // semaine est arithmétiquement impossible à couvrir en laissant deux
    // repos à chacun. C'est ce qui rendait certaines semaines injouables.
    const cap=gens.reduce((a2,em)=>a2+Math.min(5,
      open.filter(d=>!(em.indispo&&em.indispo[d]!==undefined)).length),0);
    const tetes=()=>open.reduce((a2,d)=>a2+Math.max(needs[pole][d].m,needs[pole][d].s),0);
    const calmes=open.slice().sort((a2,c)=>w[a2]-w[c]);
    const charges=open.slice().sort((a2,c)=>w[c]-w[a2]);
    guard=0;
    while(tetes()>cap && guard++<60){
      const d=calmes.find(x=>Math.max(needs[pole][x].m,needs[pole][x].s)>1);
      if(d===undefined) break;
      const n=needs[pole][d];
      if(n.m>=n.s) n.m--; else n.s--;
    }
    // Le dégonflage a coûté du volume : on le récupère en épaississant les
    // journées existantes, jamais en ouvrant une tête de plus. Monter la
    // composante minoritaire au niveau de la majoritaire, c'est transformer
    // deux services séparés en une coupure : même effectif, plus d'heures.
    guard=0;
    while(target-vol()>=4 && tetes()<=cap && guard++<60){
      const d=charges.find(x=>{
        const n=needs[pole][x];
        if(x===6&&dimSoirFerme) return false;
        return Math.min(n.m,n.s)<Math.min(Math.max(n.m,n.s),Math.max(1,capJour(x)));
      });
      if(d===undefined) break;
      const n=needs[pole][d];
      if(n.m<n.s) n.m++; else n.s++;
    }
  });
  const jours=[];
  for(let d=0;d<7;d++){
    if(W.ferme.includes(d)){jours.push({ferme:true,besoin:b(0,0,0,0),note:'ferme'});continue;}
    const c=needs.cuisine[d], s=needs.salle[d];
    jours.push({besoin:b(c.m,s.m,c.s,s.s), note:(d===6&&c.s===0)?'soirFerme':null});
  }
  return jours;
}

function seasonScenario(st){
  const w=st.week, W=SEASON_WEEKS[w];
  const equipe=st.roster.filter(r=>!r.parti&&(W.staff.includes(r.id)||r.id[0]==='x')).map(r=>{
    const src=Object.assign({},r);
    src.indispo={};
    if(r.arret) for(let d=0;d<7;d++) src.indispo[d]='arret';
    return src;
  });
  const ev=SEASON_EVENTS[w];
  if(ev){
    const em=equipe.find(x=>x.id===ev.emp);
    if(em&&!em.arret) ev.jours.forEach(d=>{em.indispo[d]=ev.motif;});
  }
  const jours=deriveNeeds(equipe,W);
  // les règles arrivent une par une au fil de la saison, comme dans les niveaux
  const regles={coupure:true};
  if(w>=2) regles.dimanche=true;
  if(w===4){ regles.ferie=true; if(!jours[3].ferme) jours[3].note='ferie'; }
  if(equipe.some(x=>x.appr)) regles.apprenti=true;
  const prefs=(SEASON_WISHES[w]||[]).filter(p=>equipe.some(x=>x.id===p.emp&&!x.arret))
    .map(p=>({emp:p.emp,jour:p.jour,veut:'R',txt:p.txt}));
  let hours=0;
  jours.forEach(j=>{hours+=(j.besoin.midi.cuisine+j.besoin.midi.salle)*4
    +(j.besoin.soir.cuisine+j.besoin.soir.salle)*5.75;});
  const contracts=equipe.reduce((s,x)=>s+x.contrat,0);
  let cost=0;
  const extra=Math.max(0,hours-contracts);
  equipe.forEach(x=>{cost+=coutSalarie(x,x.contrat+extra*(x.contrat/contracts));});
  return {id:'sn'+w, equipe, jours, prefs, reposConsecutifs:w>=6, regles,
    budget:Math.round(cost*1.05/10)*10, ca:W.ca,
    n:{fr:`Semaine ${w+1} / 10`,en:`Week ${w+1} / 10`},
    titre:W.nom, brief:W.txt};   // objets {fr,en} : l'interface choisit
}

function applySeasonWeek(st,S,ev){
  const deltas=[];
  const payroll=ev.total;
  const gain=Math.round(S.ca*MARGE_BRUTE-payroll);
  st.tresorerie+=gain;
  deltas.push({tag:gain>=0?'good':'bad',code:'TRESO',a:{gain}});
  st.scores.push(ev.score);
  let allRest=true, allWishes=true;
  (S.prefs||[]).forEach(pr=>{ if(st.plan[pr.emp]&&st.plan[pr.emp][pr.jour]!=='R') allWishes=false; });
  st.roster.forEach(r=>{
    if(r.parti) return;
    if(r.arret){ r.arret=false; r.fatigue=Math.max(0,r.fatigue-45); return; }
    const row=st.plan[r.id]; if(!row) return;
    let h=0,repos=0,coupures=0,fermetures=0;
    row.forEach(c=>{ h+=SHIFTS[c].h; if(c==='R')repos++; if(c==='C')coupures++;
      if(c==='S'||c==='C')fermetures++; });
    if(repos<2) allRest=false;
    // Une semaine ordinaire (deux repos, quelques coupures) laisse le
    // compteur à peu près stable : la fatigue est la conséquence d'un
    // planning trop dur, pas une fatalité de calendrier.
    r.fatigue=Math.max(0,Math.min(100,
      r.fatigue + (7-repos)*3 + coupures*3 + fermetures*1 - repos*12 - 4));
    r.compteurHS+=Math.max(0,h-35);
    let dm=0;
    if(h>44) dm-=10;
    if(coupures>4) dm-=6;
    let conse=false;
    for(let d=0;d<6;d++) if(row[d]==='R'&&row[d+1]==='R') conse=true;
    if(conse) dm+=5;
    (S.prefs||[]).forEach(pr=>{ if(pr.emp===r.id) dm += (row[pr.jour]==='R'? 8 : -12); });
    if(repos>=2) dm+=3;
    r.moral=Math.max(0,Math.min(100,r.moral+dm));
    if(r.fatigue>=85){
      r.arret=true;
      deltas.push({tag:'bad',code:'ARRET',a:{nom:r.nom}});
    } else if(r.fatigue>=70){
      deltas.push({tag:'warn',code:'FATIGUE',a:{nom:r.nom}});
    }
    if(r.moral<=18){
      r.parti=true;
      deltas.push({tag:'bad',code:'QUIT',a:{nom:r.nom}});
      st.roster.push(Object.assign(e('x'+st.roster.length,
        'Extra '+(st.roster.filter(z=>z.id[0]==='x').length+1), r.pole,'interim',35,Math.round(r.taux*1.4),false),
        {fatigue:20,moral:60,compteurHS:0,arret:false,parti:false}));
    } else if(r.moral<=30){
      deltas.push({tag:'warn',code:'MORAL',a:{nom:r.nom}});
    }
    if(r.compteurHS>=40) deltas.push({tag:'warn',code:'HS_WARN',a:{nom:r.nom}});
    else if(r.compteurHS>=22) deltas.push({tag:'info',code:'HS',a:{nom:r.nom,h:r.compteurHS}});
  });
  if(allRest) deltas.push({tag:'good',code:'GOOD_REST',a:{}});
  if(allWishes&&(S.prefs||[]).length) deltas.push({tag:'good',code:'WISHES',a:{}});
  st.log.push({week:st.week,score:ev.score,gain});
  // on conserve la grille : le serveur rejoue la saison entière pour valider
  st.grids = st.grids || [];
  st.grids[st.week] = st.plan;
  st.week++;
  st.plan=null;
  return deltas;
}
function newSeason(){
  return {week:0,tresorerie:0,scores:[],log:[],plan:null,grids:[],
    roster:SEASON_TEAM.map(x=>Object.assign({},x,{fatigue:12,moral:72,compteurHS:0,arret:false,parti:false}))};
}

/* ---------- générateur ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function seedToInt(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function randomSeed(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';
  for(let i=0;i<5;i++)s+=A[Math.floor(Math.random()*A.length)];return s;}

// Les responsables sont tirés séparément : un commis ou un serveur ne peut pas
// encadrer un service, donc le rôle doit suivre la fonction, pas l'ordre de tirage.
const RND_NAMES={
  cuisine:{
    leads:[['Marc','chef'],['Inès','second'],['Nadia','second'],['Karim','chef']],
    others:[['Tom','commis'],['Hugo','cuisinier'],['Sami','plongeur'],['Lucas','cuisinier'],
            ['Rachid','commis'],['Iris','cuisinier'],['Bilal','plongeur'],['Jonas','commis']]},
  salle:{
    leads:[['Claire','mh'],['Nora','rang'],['Yanis','rangM'],['Emma','rang'],
            ['Victor','rangM'],['Leonora','rang']],
    others:[['Léa','serveuse'],['Paul','serveur'],['Zoé','serveuse'],['Théo','serveur'],
            ['Mina','serveuse'],['Adam','serveur'],['Jade','serveuse']]}};

function generateWeek(seedStr,diff){
  const rnd=mulberry32(seedToInt(seedStr+'|'+diff));
  const pick=(a)=>a[Math.floor(rnd()*a.length)];
  const openDays=[5,6,6,7,7][diff-1];
  const closed=[];
  while(closed.length<7-openDays){const d=Math.floor(rnd()*7);if(!closed.includes(d))closed.push(d);}
  const intensity=[0.62,0.78,0.92,1.06,1.2][diff-1];
  const jours=[];
  for(let d=0;d<7;d++){
    if(closed.includes(d)){jours.push({ferme:true,besoin:b(0,0,0,0),note:'ferme'});continue;}
    const we=(d>=4)?1.28:1;
    const m=Math.max(1,Math.round(intensity*we*2.1+rnd()*0.6));
    const s=Math.max(1,Math.round(intensity*we*2.9+rnd()*0.6));
    jours.push({besoin:b(m,m,s,s)});
  }
  // Les règles optionnelles suivent la difficulté : une semaine facile se
  // joue avec le socle légal seul, une semaine intense ajoute les coûts
  // qui font vraiment dérailler une masse salariale.
  const regles={};
  if(diff>=2) regles.coupure=true;
  if(diff>=3) regles.dimanche=true;
  if(diff>=4){
    const ouverts=[];
    for(let d=0;d<7;d++) if(!closed.includes(d)) ouverts.push(d);
    if(ouverts.length){
      regles.ferie=true;
      jours[ouverts[Math.floor(rnd()*ouverts.length)]].note='ferie';
    }
  }
  const scen={jours,equipe:[],prefs:[],reposConsecutifs:diff>=4,regles};
  const polAppr = diff>=5 ? (rnd()<0.5?'cuisine':'salle') : null;
  if(polAppr) regles.apprenti=true;
  ['cuisine','salle'].forEach(pole=>{
    let lunch=0,dinner=0,maxC=0;
    jours.forEach(j=>{const l=j.besoin.midi[pole],dd=j.besoin.soir[pole];
      lunch+=l;dinner+=dd;maxC+=Math.min(l,dd);});
    const hours=lunch*4+dinner*5.75;
    const personDays=lunch+dinner-maxC;
    const openCount=7-closed.length;
    const perPerson=Math.max(1,Math.min(openCount, openCount-Math.max(0,2-closed.length)));
    // l'effectif doit suffire à la fois en jours disponibles et en volume horaire :
    // sans le second critère, une petite brigade se retrouve à 48 h par tête.
    const slack=[1.10,1.05,1.0,0.97,0.94][diff-1];
    // un apprenti n'est jamais disponible le soir : on dimensionne le pôle
    // pour que les fermetures tiennent sans lui, puis on l'ajoute en plus.
    const avecAppr = pole===polAppr;
    const size=Math.max(3,Math.ceil(personDays/perPerson),Math.ceil(hours*slack/39))
      + (avecAppr?1:0);
    let budgetH=hours*slack;
    const leads=RND_NAMES[pole].leads.slice(), others=RND_NAMES[pole].others.slice();
    const nLeads=Math.min(leads.length, size>=6?3:2);
    const take=(arr)=>arr.length?arr.splice(Math.floor(rnd()*arr.length),1)[0]:null;
    for(let i=0;i<size;i++){
      const isResp=i<nLeads;
      const entry=(isResp?take(leads):take(others))||take(others)||take(leads)
        ||['Extra '+(i+1),isResp?'rang':'extra'];
      const [nom,role]=entry;
      // un peu de dispersion : une brigade réelle mélange temps pleins et partiels
      const part=budgetH/(size-i)*(0.82+rnd()*0.38);
      let contrat=Math.max(20,Math.min(39,Math.round(part)));
      budgetH-=contrat;
      const taux=pole==='cuisine'
        ? (role==='chef'?24:role==='second'?19:15+Math.round(rnd()*2))
        : (role==='mh'?21:role==='rang'||role==='rangM'?17:15.5);
      scen.equipe.push(e(pole[0]+i,nom,pole,role,contrat,taux,isResp));
    }
    if(avecAppr){
      const a=scen.equipe.filter(x=>x.pole===pole&&!x.resp).pop();
      if(a){ a.appr=true; a.role='apprenti'; a.taux=8.5; a.contrat=Math.min(a.contrat,35); }
      else regles.apprenti=false;
    }
  });
  let hours=0;
  jours.forEach(j=>{hours+=(j.besoin.midi.cuisine+j.besoin.midi.salle)*4
    +(j.besoin.soir.cuisine+j.besoin.soir.salle)*5.75;});
  const contracts=scen.equipe.reduce((s,x)=>s+x.contrat,0);
  const extra=Math.max(0,hours-contracts);
  let cost=0;
  scen.equipe.forEach(x=>{cost+=coutSalarie(x,x.contrat+extra*(x.contrat/contracts));});
  const marge=[1.14,1.10,1.07,1.04,1.02][diff-1];
  // Provision pour les majorations et indemnités : coutSalarie ne les
  // connaît pas, mais elles tomberont bien sur la masse salariale. On les
  // estime sur les besoins affichés, pas au forfait : un férié en plein
  // week-end ne coûte pas le même prix qu'un férié un mardi calme.
  const tauxMoy=scen.equipe.reduce((a,x)=>a+x.taux,0)/Math.max(1,scen.equipe.length);
  let sup=0;
  jours.forEach((j,d)=>{
    if(j.ferme) return;
    const hJ=(j.besoin.midi.cuisine+j.besoin.midi.salle)*4
            +(j.besoin.soir.cuisine+j.besoin.soir.salle)*5.75;
    let mj=0;
    if(regles.dimanche&&d===6) mj+=MAJO_DIM;
    if(regles.ferie&&j.note==='ferie') mj+=MAJO_FERIE;
    sup+=hJ*tauxMoy*mj;
    if(regles.coupure)
      sup+=(Math.min(j.besoin.midi.cuisine,j.besoin.soir.cuisine)
           +Math.min(j.besoin.midi.salle,j.besoin.soir.salle))*COUPURE_EUR;
  });
  scen.budget=Math.round((cost*marge+sup)/10)*10;
  scen.ca=Math.round(scen.budget/([0.30,0.31,0.32,0.33,0.34][diff-1])/100)*100;
  scen.id='rnd-'+seedStr+'-'+diff;
  scen.n={fr:`Graine ${seedStr}`,en:`Seed ${seedStr}`};
  scen.diff=diff;
  scen.seed=seedStr;
  scen.openDays=7-closed.length;
  return scen;
}



/* --------------------------------------------------------------------
   Défi du jour : la graine dérive de la date, donc tout le monde joue
   exactement la même semaine et le classement se remet à zéro chaque
   jour. Le format reste celui que l'Edge Function sait revalider.
   -------------------------------------------------------------------- */
const DAILY_DIFF = 3;
function dailySeed(date){
  const d = date || new Date();
  const y = String(d.getUTCFullYear()).slice(2);
  const m = String(d.getUTCMonth()+1).padStart(2,'0');
  const j = String(d.getUTCDate()).padStart(2,'0');
  return `D${y}${m}${j}`;
}
function dailyScenario(date){
  const scen = generateWeek(dailySeed(date), DAILY_DIFF);
  scen.daily = true;
  return scen;
}

/* --------------------------------------------------------------------
   Tutoriel : deux salariés, quatre jours ouverts, un besoin d'une
   personne par service. La solution tient en quatre coupures chacun,
   soit exactement leur contrat, ce qui permet de faire découvrir la
   palette, la ligne de besoin, le compteur d'heures et le repos de 11 h
   sans jamais noyer le joueur.
   -------------------------------------------------------------------- */
const TUTORIAL = {
  id:'tuto',
  n:{fr:'Tutoriel',en:'Tutorial'},
  titre:{fr:'Prendre le service',en:'Taking over the pass'},
  sous:{fr:'2 salariés · 4 jours',en:'2 staff · 4 days'},
  brief:{fr:"Un petit restaurant ouvert du mardi au vendredi. Un cuisinier, une responsable de salle, un service midi et un service soir par jour. Suivez les étapes.",
    en:"A small restaurant open Tuesday to Friday. One cook, one floor lead, one lunch and one dinner service a day. Follow the steps."},
  ca:6000, budget:1800, reposConsecutifs:false,
  jours:[
    {ferme:true,besoin:b(0,0,0,0),note:'ferme'},
    {besoin:b(1,1,1,1)},{besoin:b(1,1,1,1)},{besoin:b(1,1,1,1)},{besoin:b(1,1,1,1)},
    {ferme:true,besoin:b(0,0,0,0),note:'ferme'},
    {ferme:true,besoin:b(0,0,0,0),note:'ferme'}],
  equipe:[
    e('c1','Marc Lefèvre','cuisine','chef',39,24,true),
    e('s1','Claire Aubert','salle','mh',39,21,true)],
  prefs:[],
};

/* --------------------------------------------------------------------
   Verrous et assainissement des grilles.
   Le serveur ne fait pas confiance à ce qu'il reçoit : toute case
   verrouillée (fermeture, congé, arrêt) ou tout code inconnu est ramené
   au repos avant notation. Une grille trafiquée perd son avantage au
   lieu d'être rejetée.
   -------------------------------------------------------------------- */
function isLocked(S,em,d){
  return (em.indispo && em.indispo[d]!==undefined) || S.jours[d].ferme;
}
function emptyPlan(S){
  const p={};
  S.equipe.forEach(em=>{p[em.id]=[0,0,0,0,0,0,0].map(()=> 'R');});
  return p;
}
function applyLocks(S,p){
  S.equipe.forEach(em=>{ if(em.indispo) Object.keys(em.indispo).forEach(d=>{p[em.id][+d]='R';}); });
  S.jours.forEach((j,d)=>{ if(j.ferme) S.equipe.forEach(em=>{p[em.id][d]='R';}); });
  return p;
}
function sanitizePlan(S,raw){
  const clean=emptyPlan(S);
  if(!raw || typeof raw!=='object') return clean;
  S.equipe.forEach(em=>{
    const row=raw[em.id];
    if(!Array.isArray(row)) return;
    for(let d=0; d<7; d++){
      const c=row[d];
      if(typeof c!=='string' || !SHIFTS[c]) continue;
      if(isLocked(S,em,d)) continue;
      clean[em.id][d]=c;
    }
  });
  return clean;
}

/* --------------------------------------------------------------------
   Exports. Le navigateur et l'Edge Function consomment la même surface.
   -------------------------------------------------------------------- */
export {
  SHIFTS, ORDER, KEYMAP,
  coutSalarie, supplements, evaluate,
  RULES_ORDER, COUPURE_EUR, MAJO_DIM, MAJO_FERIE,
  LEVELS,
  SEASON_TEAM, SEASON_WEEKS, SEASON_EVENTS, SEASON_WISHES, MARGE_BRUTE,
  deriveNeeds, seasonScenario, applySeasonWeek, newSeason,
  mulberry32, seedToInt, randomSeed, generateWeek,
  isLocked, emptyPlan, applyLocks, sanitizePlan,
  TUTORIAL, DAILY_DIFF, dailySeed, dailyScenario,
};
