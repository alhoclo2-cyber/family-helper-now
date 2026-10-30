<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use ReservationSummaryPanel with the current Request; persist the chosen hourly salary at payment confirmation.
- Keep the five home illustrations in AudienceIllustrations with semantic tokens and photo-ready medallions.
- Keep the proposed-missions tab state in StudentFlow above mission detail/list switching so returning from a mission preserves the selection.
- Share mission hour limits through missionHours and rapid-arrival validation through arrival; use ArrivalFields for companion inputs so booking, simulations and mission timing remain consistent.
- Mount rapid-request expiry and the family acceptance banner in the root layout so account-page navigation cannot pause checks or hide notifications; route search selects the existing family response screen.
- Keep both family price bubbles on the same estimateMissionCost calculation, with rounding only at its return boundary, so their totals cannot diverge.
- Validate family hourly salaries through one shared predicate before submission and persistence, returning payment failures to the visible payment error state to prevent silent rejection.
- All fields in signup forms are required to validate the account. Contract identity (birth name and three-part address) lives in profiles and is required at signup, but must never be added to the blocking useClientDossier / missingCompanionItems checks, so existing accounts remain accessible.
- profiles.last_name is the name in use; profiles.birth_name is the birth name. Reuse IdentityNames for consistent copying and editing in signup and account forms.
- Information notices state that identity data appears on the employment contract only if a contract is necessary.
- Contracts reference companions and missions by text (companion_ref, first_mission_id) while missions remain in memory in store.ts.
- Keep contract identity completeness and app settings in independent React Query hooks; settings writes use Mandataire-only RLS and the contract signature log is writable only by service_role.
- Règle du seuil : contrat écrit obligatoire au-delà de 3 h sur une semaine civile (sans moyenne) ou à partir de la 5ᵉ semaine consécutive avec le même compagnon ; jusqu'à 4 semaines consécutives, pas de contrat.
- Les recherches automatiques n'attribuent jamais un compagnon qui atteindrait le seuil de contrat ou avec qui un contrat est en vigueur ; getPairState (contractEligibility.ts) est la seule source de cette décision.
- Le parcours contrat n'est actif que si app_settings.contract_flow_enabled vaut true ; sinon le comportement historique est conservé (hors correction du seuil et choix du compagnon amélioré).
- En Prise de RDV, le Particulier peut choisir n'importe quel compagnon, par recherche (prénom ou numéro d'inscription uniquement) ou dans la liste des disponibles. Dans les listes, un compagnon s'affiche par son prénom, l'initiale de son nom et son numéro d'inscription ; jamais par son nom complet.
- La décision CDI / CDD est une fonction pure (src/lib/contractDecision.ts) : le CDD n'est proposé que pour remplacer un salarié habituel absent, avec une date de fin fixe limitée à 18 mois ; en cas de doute, de réponse manquante ou incohérente, la décision retombe toujours sur CDI.
- La décision CDI / CDD sera rappelée côté serveur à la signature : le résultat enregistré par le navigateur ne fait jamais foi.
- Le parcours contrat ne pose aucune question sur la santé et ne comporte aucune zone de texte libre : la nature de l'absence du salarié remplacé n'est jamais collectée.
- Le questionnaire 2 enregistre ses choix dans work_contracts.answers.terms (type ContractTerms, contractTerms.ts) ; ses règles (période d'essai CDI 30 jours maximum, CDD 1 jour par semaine plafonné à 2 semaines jusqu'à 6 mois puis 1 mois, délai de congés d'au moins 2 mois, planning défini au plus 48 h par semaine) sont des fonctions pures, rappelées côté serveur à la signature.
- Changer le type de contrat (CDI ↔ CDD) dans le questionnaire 1 supprime les réponses du questionnaire 2.
- Le questionnaire du contrat ne demande aucune donnée du Compagnon : elles sont reprises côté serveur.
- Solélia n'impose aucun choix d'employeur : planning défini ou durée irrégulière et jours fériés sont choisis par le Particulier.
- Le paiement du salaire suit le circuit de la plateforme : acomptes possibles, solde au plus tard le 5 du mois suivant ; aucune question n'est posée au particulier sur ce point.
- 5-day notice is contractual, never blocking; closer mission only with express companion consent; mission must start after the companion answer deadline. The companion may freely refuse.
- Require employer CESU in the threshold modal and reverify it server-side at signature.
- La signature de l'employeur est faite par une fonction serveur qui revérifie tout ; le navigateur ne fait jamais foi. Les données personnelles du compagnon ne sont jamais envoyées en clair au particulier avant la signature des deux parties.
- Preserve signed hashes; display final_document after both signatures. PDFs allow in_force/ended/terminated/closed, with final hash checks and private server storage reuse.
- contract_snapshot is server-only (supabaseAdmin after caller check); grant every new work_contracts column. Employer withdrawal uses a locked service-role RPC and reconciles memory missions.
- Use the masked companion DTO and pair/effective-date Paris calendar. Attach cached contracts atomically at acceptance for root planning events; suppress duplicate emails, allowing empty planning only on cancellation.
- Le compagnon ne voit jamais les coordonnées exactes de la famille avant la signature des deux parties ; le refus du contrat est libre, sans motif ni pénalité ; aucune acceptation automatique pour une mission sous contrat ; en cas d'erreur sur ses informations, le compagnon les corrige dans son compte, et le contrat final utilise les informations du compte au moment de sa signature.
