# Solélia — Présence et services à domicile

Solélia est une plateforme de mise en relation qui permet à des particuliers de trouver un **compagnon à proximité** pour des besoins de présence, d'accompagnement et de services à domicile, éligibles au cadre des Services à la Personne (SAP).

Principe directeur : **« Un besoin = un compagnon à proximité. »**

> État du projet : **prototype fonctionnel** (données fictives, sans backend).
> Ce README décrit l'état réel du code. Il distingue clairement ce qui est
> **implémenté** de ce qui est **prévu / en développement**.

---

## 1. Présentation et positionnement

Solélia s'adresse aux personnes qui ont besoin d'une présence ponctuelle ou régulière :

- 👵 nos aînés ;
- 👶 les enfants (dès 3 ans) ;
- 🤰 grossesse & maternité ;
- 🏥 retour d'hospitalisation & convalescence ;
- 🤝 handicap & invalidité (temporaire ou permanent) ;
- 🩹 blessures & imprévus.

Les usages prévus incluent notamment : présence et compagnie auprès des personnes
âgées, accompagnement d'enfants à partir de 3 ans, aide lors de périodes de
fragilité temporaire, présence pendant les devoirs, accompagnement ou retour
d'école, accompagnement lors de sorties, récupération d'un colis, de courses ou
d'un médicament (en prolongement d'une présence ou d'un accompagnement), aide
légère à domicile, préparation simple de repas, et autres services de présence
et d'accompagnement dans le périmètre défini par la plateforme.

L'interface est pensée pour un usage mobile, épurée, avec de gros boutons et des
textes très lisibles.

## 2. Fonctionnement général

L'application propose trois espaces, choisis depuis l'écran d'accueil :

- **Client / Famille** — déclarer un besoin et trouver un compagnon ;
- **Compagnon** — étudiants, actifs ou retraités qui réalisent les missions ;
- **Admin** — validation des candidatures de compagnons (démo).

Deux modes de demande sont implémentés côté client :

- **Besoin rapidement (ex-SOS)** — recherche active d'un compagnon disponible à
  proximité ; le premier compagnon qui accepte remporte la mission (premier
  répondant). Ce type de demande n'est ni modifiable ni annulable.
- **Rendez-vous (RDV)** — demande planifiée à une date/heure choisie.

## 3. Parcours client (implémenté)

1. Écran d'accueil : grand bouton « Besoin rapidement » ou prise de rendez-vous.
2. Formulaire simple : type de besoin, adresse, téléphone, et selon le besoin
   des précisions (durée pour la présence, poids/taille du colis, âge/classe de
   l'enfant, champ « Autre » à préciser, informations complémentaires).
3. Écran d'attente : « Recherche d'un compagnon à proximité… » avec animation.
4. Dès qu'un compagnon accepte : affichage de sa fiche (prénom, photo, badge
   d'expérience, pouces levés) avec photo de vérification (selfie déposé à
   l'inscription).
5. **Paiement (simulé)** : le client paie après l'acceptation pour débloquer
   les coordonnées du compagnon. Pour les RDV, le paiement finalise aussi la
   demande.
6. Contact : boutons **Appeler** et **SMS** une fois la mission acceptée.
7. Gestion du RDV : modification possible **plus de 48 h avant**, uniquement si
   un compagnon est disponible au nouveau créneau ; annulation **remboursée si
   > 48 h avant**, non remboursée sinon.
8. Fin de prestation : bouton « Recommander ce compagnon 👍 ».
9. **Compte client** : historique des commandes et **récapitulatif fiscal
   annuel** (montants, crédit d'impôt estimé à 50 %, mention case 7DB).

## 4. Parcours compagnon (implémenté)

1. Bascule **En ligne / Hors ligne** (disponibilité).
2. Liste des demandes actives (type de besoin, ville ; l'adresse exacte est
   **masquée** tant que la mission n'est pas acceptée).
3. Détail d'une demande : gros bouton « Accepter la mission ». Après
   acceptation, l'adresse exacte et le téléphone du client s'affichent.
4. Désistement possible 48 h avant un RDV : la mission repart automatiquement
   en recherche d'un autre compagnon.
5. **Critères d'intervention personnalisables** : rayon kilométrique (3 km par
   défaut), durée minimale de mission, types de tâches acceptées, préférences
   (animaux, logement non-fumeur).
6. **Candidature (enrôlement)** : dépôt des documents (pièce d'identité, carte
   étudiante ou justificatif, casier judiciaire B3, RIB) et **selfie
   obligatoire** affiché ensuite au client pour vérification d'identité.
   Statuts : non inscrit → en attente → validé / refusé (par l'Admin).
7. Acceptation obligatoire des **CGU** et des clauses d'exclusion.
8. Alerte de **réglementation CESU** (Article L. 1271-5) sur la récurrence des
   missions : à partir de la 4ᵉ semaine consécutive, un contrat écrit est
   nécessaire (modèle fourni dans l'application).
9. Bouton **« Aperçu démo »** permettant de découvrir l'espace compagnon sans
   inscription complète.

## 5. Espace Admin (implémenté, démo)

- Accès protégé par un mot de passe de démonstration (`admin2026`, visible dans
  le code — uniquement adapté au prototype).
- Tableau de bord des candidatures : validation ou refus des compagnons, avec
  consultation des documents déposés.

## 6. Types de services proposés (implémentés)

- Compagnie / Présence
- Courses urgentes
- Pharmacie
- Aide au repas
- Accompagnement sorties extérieures
- Sortir ou nourrir un animal de compagnie
- Arroser les plantes
- Retrait ou dépôt d'un colis (avec poids et taille)
- Aide aux devoirs (primaire au lycée, avec niveau/classe)
- Garde d'enfants (à partir de 3 ans)
- Accompagner un enfant (à partir de 3 ans)
- Autre (à préciser, champ libre)

## 7. Services exclus

La plateforme affiche une clause d'exclusion : les actes **médicaux et
paramédicaux**, les **actes d'hygiène**, le **portage ou levage de personnes
dépendantes**, et toute prestation nécessitant une **qualification spécifique**
sont exclus. Les demandes « Autre » personnalisées sont soumises à cette clause.

## 8. Badges d'expérience des compagnons (implémenté)

Progression calculée uniquement à partir du **nombre total de missions
réalisées** :

| Missions | Badge |
| --- | --- |
| 1 à 9 | 🌱 Nouveau compagnon |
| 10 à 49 | 🤝 Compagnon régulier |
| 50 à 99 | ⭐ Compagnon confirmé |
| 100 à 149 | 🏅 Compagnon expert |
| 150 et + | 👑 Compagnon d'élite |

Les badges sont **strictement informatifs** : ce n'est ni un système de
classement, ni un système de rémunération.

## 9. Système de satisfaction (implémenté)

- Après la prestation, le client peut attribuer un **pouce levé 👍**.
- Le profil du compagnon affiche un compteur neutre du type
  « 👍 18 clients satisfaits ».
- Il ne s'agit **pas** d'une note publique de type 1 à 5, et aucun commentaire
  n'est publié.

**Règle du moteur de recherche (critique)** : ni les badges ni les pouces
n'influencent le tri. Le classement des compagnons repose uniquement sur des
critères neutres — **distance** et **disponibilités** — sans boost de
visibilité, filtre prioritaire ni pénalité.

## 10. Modèle économique et paiement (état réel)

Implémenté dans le prototype :

- Tarif unique de base : **26 € TTC pour 1 h**, multiplié par le nombre
  d'heures au-delà (sélecteur 1 à 4 h).
- Mentions commerciales affichées : 0 € de frais de dossier, 0 € d'abonnement,
  sans engagement.
- Encadré client « Paiement CESU+ & Crédit d'Impôt (SAP) » présentant le
  crédit d'impôt de 50 %, l'avance immédiate, le cas de la 1ʳᵉ mission avec un
  nouveau compagnon et la gestion des déclarations.
- **Écran de paiement simulé** : aucune transaction réelle n'est effectuée
  (pas d'intégration Stripe ou équivalent dans le code actuel).

## 11. SAP / CESU / CESU+ / Avance immédiate

- L'application applique dans son **affichage tarifaire** le principe SAP :
  crédit d'impôt de 50 %, le client ne réglant que la moitié à la commande
  (avance immédiate), sous réserve des conditions applicables.
- Les textes indiquent que l'avance immédiate suppose que le compte CESU du
  compagnon soit validé par l'URSSAF, et que la première mission avec un
  nouveau compagnon peut être réglée au tarif plein en attendant.
- **À ce stade, aucune intégration réelle n'est opérationnelle** : API Tierce
  Déclaration CESU, CESU+ / Avance immédiate, Stripe Connect, déclarations
  URSSAF automatisées. Ces éléments sont **prévus / en cours d'intégration**,
  et les modalités (dont les délais) restent **à confirmer avec l'URSSAF**.
- Le récapitulatif fiscal annuel affiché dans le compte client est une
  **estimation** à visée informative (mention case 7DB).

## 12. Architecture technique actuelle

- **Frontend uniquement** : application React monopage en SSR léger, sans
  backend ni base de données.
- **État partagé en mémoire** (`src/lib/store.ts`) via `useSyncExternalStore` :
  demandes, acceptations (verrouillage « premier répondant »), annulations,
  pouces.
- **Persistance locale** (`localStorage`) : compte client et historique,
  candidatures compagnons, critères d'intervention, acceptation des CGU.
- Toutes les données sont **fictives/simulées** : compagnons, photos
  (pravatar), demandes d'exemple, paiement, validation Admin.

## 13. Technologies utilisées

- **TanStack Start v1** (React 19, TanStack Router, TanStack Query) + Vite
- **TypeScript**, **Tailwind CSS v4**, composants **shadcn/ui** (Radix)
- **zod**, **date-fns**, **sonner**

## 14. Installation et lancement

```sh
npm install
npm run dev
```

Puis ouvrez l'URL indiquée par Vite. Scripts utiles : `npm run build`,
`npm run lint`, `npm run format`.

## 15. Structure générale du projet

```
src/
├── routes/
│   ├── __root.tsx        # racine, métadonnées
│   └── index.tsx         # l'essentiel de l'application (3 espaces)
├── components/
│   ├── CompanionBadges.tsx        # badges, pouces, recommandation
│   ├── CompanionProfilePanel.tsx  # critères d'intervention du compagnon
│   ├── CesuRecurrence.tsx         # alerte réglementaire CESU (L. 1271-5)
│   ├── Cgu.tsx                    # CGU à acceptation obligatoire
│   └── ui/                        # composants shadcn/ui
├── lib/
│   ├── store.ts                   # store mémoire (demandes, compagnons, badges)
│   └── companionSettings.ts       # préférences compagnon (localStorage)
└── assets/                        # logo et liseret floral Solélia
```

## 16. Fonctionnalités déjà présentes

- Deux parcours de demande : « Besoin rapidement » (premier répondant) et RDV
  planifié.
- Formulaire adaptatif selon le besoin (durée, colis, enfants, « Autre »…).
- Acceptation atomique des missions, désistement compagnon avec remise en
  recherche, annulation client avec règle des 48 h.
- Paiement simulé débloquant les coordonnées, contact appel/SMS.
- Candidature compagnon avec documents + selfie, validation Admin, aperçu démo.
- Badges d'expérience et pouces levés, sans impact sur le tri.
- Critères d'intervention du compagnon (rayon, durée min, tâches, préférences).
- Compte client avec historique et récapitulatif fiscal annuel estimé.
- CGU obligatoires, clause d'exclusion, alerte récurrence CESU.
- Masquage de l'adresse exacte avant acceptation.

## 17. Fonctionnalités prévues / en développement

Non opérationnelles dans le code actuel :

- Paiement réel en ligne (Stripe / Stripe Connect) ;
- intégration CESU+ / Avance immédiate et API Tierce Déclaration CESU ;
- déclarations URSSAF automatisées et attestation fiscale officielle ;
- comptes utilisateurs authentifiés côté serveur et base de données ;
- notifications temps réel entre clients et compagnons ;
- délais d'obtention de numéro CESU ou d'activation CESU+ (à confirmer avec
  l'URSSAF).

## 18. Limites actuelles du prototype

- Aucune donnée n'est persistée côté serveur : tout est en mémoire ou en
  `localStorage`, et un rechargement peut réinitialiser les demandes en cours.
- Compagnons, photos, notes historiques et demandes d'exemple sont fictifs.
- Le paiement est une simulation visuelle.
- L'accès Admin repose sur un mot de passe en clair dans le code (démo
  uniquement, à ne pas réutiliser en production).
- Les montants fiscaux affichés sont des estimations, sans valeur officielle.

---

**Note sur le nom** : le produit s'appelle **Solélia**. Le dépôt peut encore
contenir des références à d'anciennes appellations (ex. « SOS Étudiants »,
« Famille Connect ») conservées pour des raisons techniques.

Projet développé avec [Lovable](https://lovable.dev).
