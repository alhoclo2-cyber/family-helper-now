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
