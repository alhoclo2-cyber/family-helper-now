import { useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "./ui/alert-dialog";
import { MandataireContext, DossierBlock } from "./MandataireContracts";
import { useSession } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { formatMissionRange, getMissionStart, getMissionEnd } from "@/lib/missionClosure";
import { formatDateFr } from "@/lib/accountState";
import { listMissionPayments } from "@/lib/payments.functions";
import { getArchive, openArchiveDoc } from "@/lib/archive";
import { changeRestriction, readRestrictions, useCompanionRestrictions, companionClosureBlockers, emptyRestriction, CLOSURE_REMINDER_MS, ARCHIVE_RETENTION_YEARS, RESTRICTION_LABELS, RESTRICTION_ACTION_LABELS, processRestrictionDeadlines, type RestrictionAction } from "@/lib/companionRestrictions";
const control = "h-auto whitespace-normal py-3 text-foreground bg-card w-full min-w-0";
export function CompanionRestrictionPanel({ userId, email }: { userId: string; email: string }) {
  const { session } = useSession();
  const all = useCompanionRestrictions(); const state = all[userId] ?? emptyRestriction();
  const actor = session?.user.email ?? session?.user.id ?? "";
  const [reason, setReason] = useState(""); const [typed, setTyped] = useState("");
  const [confirm, setConfirm] = useState<RestrictionAction | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const ctx = useContext(MandataireContext); const requests = useStore(s => s.requests);
  const ids = ctx.contracts.filter(c => c.companion_user_id === userId).map(c => c.id);
  const mine = requests.filter(r => r.student?.id === userId || (r.contractId && ids.includes(r.contractId)));
  const upcoming = mine.filter(r => r.status === "accepted" && (getMissionEnd(r) ?? Infinity) > Date.now()).sort((a,b) => (getMissionStart(b) ?? 0) - (getMissionStart(a) ?? 0));
  const fetchPayments = useServerFn(listMissionPayments);
  const payments = useQuery({ queryKey: ["restriction-payments", userId], queryFn: () => fetchPayments({ data: {} }), refetchInterval: 30_000 });
  const ownPayments = (payments.data ?? []).filter(p => p.companion_user_id === userId);
  const blockers = companionClosureBlockers(mine.map(r => ({ status: r.status, start: getMissionStart(r), end: getMissionEnd(r), completion: r.completion, declaredAt: r.declaredAt })), ownPayments, Date.now());
  const unavailable = payments.isPending || payments.isError;
  const apply = async () => {
    if (!confirm || busy) return;
    setError(""); setBusy(true);
    try {
      if (confirm === "closure_requested" && (typed !== "CLÔTURER" || reason.trim().length < 10 || unavailable || blockers.length)) throw new Error("La clôture est bloquée. Vérifiez les confirmations et les actions en cours.");
      changeRestriction(userId, confirm, actor, reason, email); setReason(""); setTyped(""); setConfirm(null);
    } catch(e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(false); }
  };
  const advance = async (days: number) => {
    setBusy(true); setError("");
    try {
      const all = readRestrictions(); const s = all[userId];
      if (!s || s.status !== "closure_pending") return;
      const at = Date.now() + days * 86400000;
      localStorage.setItem("solelia-mandataire-restrictions", JSON.stringify({ ...all, [userId]: { ...s, closureAt: at, reminderAt: undefined } }));
      window.dispatchEvent(new Event("solelia-mandataire-restrictions-changed"));
      await processRestrictionDeadlines();
    } catch(e) { setError(e instanceof Error ? e.message : "Simulation impossible."); } finally { setBusy(false); }
  };
  return <DossierBlock title="Suspension de l'accès" open>
    <p className="text-muted-foreground">Simulation locale uniquement : aucune donnée supprimée, aucune connexion réellement interdite. Les missions et contrats restent inchangés. Les contrôles portent sur les missions de cette session et les 100 paiements disponibles, pas sur un dossier exhaustif.</p>
    <p className="font-bold">{RESTRICTION_LABELS[state.status] ?? "Accès actif"} (simulation)</p>
    {state.status !== "active" && <><p className="break-words">Motif : {state.reason}</p><p>Suspension : {formatDateFr(state.suspendedAt)} · Auteur : {state.author}</p></>}
    {(state.status === "active" || state.status === "suspended") && <label className="flex flex-col gap-2 font-semibold">Motif (10 caractères minimum)<textarea aria-label="Motif de suspension ou clôture" value={reason} onChange={e => setReason(e.target.value)} className="bg-card text-foreground border border-border rounded-lg p-3 min-h-24 w-full" /></label>}
    {state.status === "active" && <Button variant="outline" className={control} disabled={busy || !actor || reason.trim().length < 10} onClick={() => setConfirm("suspension")}>⛔ Suspendre l'accès</Button>}
    {state.status === "suspended" && <>
      <Button variant="outline" className={control} disabled={busy} onClick={() => setConfirm("reactivation")}>Réactiver l'accès</Button>
      <h3 className="font-bold text-base">Clôture du compte</h3>
      {unavailable && <p className="text-destructive">{payments.isError ? "Vérification des paiements impossible : clôture bloquée." : "Vérification des paiements…"}</p>}
      {blockers.length > 0 && <div><p className="font-bold text-destructive">Ce qui bloque la clôture :</p><ul className="list-disc pl-5">{blockers.map(b => <li key={b}>{b}</li>)}</ul></div>}
      <label className="flex flex-col gap-2 font-semibold">Tapez CLÔTURER pour confirmer<Input aria-label="Confirmation CLÔTURER" value={typed} onChange={e => setTyped(e.target.value)} /></label>
      <Button variant="outline" className={control} disabled={busy || unavailable || !!blockers.length || reason.trim().length < 10 || typed !== "CLÔTURER"} onClick={() => setConfirm("closure_requested")}>Clôturer le compte</Button>
    </>}
    {state.status === "closure_pending" && <><p className="font-bold">Clôture prévue le {formatDateFr(state.closureAt)}</p><Button variant="outline" className={control + " border-2 border-primary font-bold"} disabled={busy} onClick={() => setConfirm("closure_cancelled")}>Annuler la clôture</Button><details><summary className="cursor-pointer font-bold">Simulation du délai</summary><div className="flex flex-col gap-2 mt-3"><Button variant="outline" className={control} disabled={busy} onClick={() => advance(CLOSURE_REMINDER_MS / 86400000)}>Simuler le rappel à J−3</Button><Button variant="outline" className={control} disabled={busy || unavailable || !!blockers.length} onClick={() => advance(0)}>Avancer à la clôture (test)</Button></div></details></>}
    {state.status === "closed" && <><p>Fiche en lecture seule (simulation). Les données réelles restent conservées sans modification.</p><p>Archives de démonstration : {ARCHIVE_RETENTION_YEARS} ans. Les contrats et PDF réels ne sont ni déplacés ni remplacés.</p>{getArchive(state.email)?.documents.map(d => <Button key={d.id} variant="outline" className={control} onClick={() => { changeRestriction(userId, "archive_view", actor); openArchiveDoc(d); }}>{d.title}</Button>)}<a className="text-primary underline" href={`/archives?email=${encodeURIComponent(state.email)}`}>Mes archives</a></>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <AlertDialog open={confirm !== null} onOpenChange={o => { if (!o && !busy) setConfirm(null); }}><AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto"><AlertDialogHeader><AlertDialogTitle>{confirm === "closure_requested" ? "Dernière confirmation : clôturer ce compte ?" : confirm ? RESTRICTION_ACTION_LABELS[confirm] : "Confirmation"}</AlertDialogTitle><AlertDialogDescription>Simulation uniquement. Aucune mission ni aucun contrat ne sera annulé.</AlertDialogDescription></AlertDialogHeader>
      {confirm === "suspension" && <><p className="font-bold">Missions acceptées à venir</p>{!upcoming.length && <p>Aucune mission identifiée dans cette session.</p>}{upcoming.map(r => <p key={r.id}>{r.need} · {formatMissionRange(r)}</p>)}<p className="font-bold">Pensez à prévenir les familles concernées et à leur proposer un autre compagnon.</p></>}
      {confirm === "closure_requested" && <p>La clôture sera programmée dans 14 jours. Seul le Mandataire pourra l'annuler.</p>}
      <AlertDialogFooter><AlertDialogCancel className="h-auto whitespace-normal" disabled={busy}>Retour</AlertDialogCancel><AlertDialogAction className="h-auto whitespace-normal" disabled={busy} onClick={e => { e.preventDefault(); void apply(); }}>Confirmer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </DossierBlock>;
}
export function CompanionRestrictionNotice({ userId }: { userId?: string }) {
  const all = useCompanionRestrictions(); const s = userId ? all[userId] : undefined;
  if (!s || s.status === "active") return null;
  return <div className="border border-border bg-card p-4 text-foreground break-words"><p className="font-bold">{RESTRICTION_LABELS[s.status]} — simulation</p><p>Votre accès à la plateforme est suspendu pour non-respect des règles de Solélia Accompagnement. Motif : {s.reason} Vous pouvez nous écrire à <a href="mailto:solelia.accompagnement@gmail.com" className="text-primary underline">solelia.accompagnement@gmail.com</a>.</p><p className="text-muted-foreground">Simulation uniquement, sans suppression réelle ni interdiction de connexion.</p>{s.closureAt && <p>Clôture prévue le {formatDateFr(s.closureAt)}. Pour demander l'annulation, écrivez-nous.</p>}</div>;
}