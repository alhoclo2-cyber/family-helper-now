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

- Keep the client booking recap in a single reusable ReservationSummaryPanel fed by the current Request; persist the selected hourly salary when payment confirms so the final recap reflects the actual choice.
- Keep the five home-only audience illustrations together in AudienceIllustrations with semantic palette tokens, so their visual language stays consistent and each medallion can later accept a photo.
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
