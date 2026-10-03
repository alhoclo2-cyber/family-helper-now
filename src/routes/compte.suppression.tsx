import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AccountPageShell, BlockerBox } from "@/components/AccountPageShell";
import { AccountSimulationPanel } from "@/components/AccountSimulationPanel";
import { formatDateFr, useAccountState } from "@/lib/accountState";
import { useAccountBlockers, useAccountRole } from "@/lib/accountBlockers";

export const Route = createFileRoute("/compte/suppression")({
  head: () => ({
    meta: [
      { title: "Supprimer mon compte — Solélia" },
      { name: "description", content: "Demandez la suppression de votre compte Solélia." },
      { property: "og:title", content: "Supprimer mon compte — Solélia" },
      { property: "og:description", content: "Suppression de votre compte Solélia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AccountPageShell title="Supprimer mon compte">{(s) => <DeleteContent session={s} />}</AccountPageShell>
  ),
});

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="font-bold text-base">{title}</p>
      <p className="mt-1 text-base">{text}</p>
    </div>
  );
}

function DeleteContent({ session }: { session: Session }) {
  const uid = session.user.id;
  const account = useAccountState(uid);
  const role = useAccountRole(uid);
  const { loading, error, blockers } = useAccountBlockers(uid, role.data, account.state.sim);
  const [typed, setTyped] = useState("");
  const { state } = account;
  const failed = error || role.isError;
  const disabled = loading || role.isLoading || failed || blockers.length > 0;
  const ok = typed.trim().toUpperCase() === "SUPPRIMER";

  return (
    <>
      {state.status === "deletion_pending" ? (
        <div className="flex flex-col gap-4">
          <p className="text-base">
            Suppression prévue le {formatDateFr(state.deletionEffectiveAt)}. Votre compte est inactif jusqu'à cette date. Vous pouvez annuler à tout moment avant.
          </p>
          <Button className="w-full h-12" onClick={() => { account.cancelDeletion(); toast.success("La suppression est annulée."); }}>
            Annuler la suppression
          </Button>
        </div>
      ) : state.status === "deleted" ? (
        <p className="text-base">
          Votre compte a été supprimé (simulation). Vos documents seront consultables dans{" "}
          <Link to="/archives" className="font-semibold text-primary underline">Mes archives</Link>.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Block title="Ce qui sera supprimé" text="Vos pièces justificatives (pièce d'identité, justificatif de domicile, RIB, et pour les compagnons : casier judiciaire et photo) et vos coordonnées." />
          <Block title="Ce qui sera conservé" text="Vos documents importants : mandat, contrats, récapitulatif de vos missions et de vos heures, reçus et attestation. Ils vous seront envoyés dans un dossier de sortie, et vous pourrez les consulter pendant 12 mois dans « Mes archives ». Solélia les conserve ensuite pendant la durée légale." />
          <Block title="Comment ça se passe" text="Vous avez 14 jours pour annuler. Nous vous enverrons un rappel quelques jours avant la fin. Après suppression, vous pourrez vous réinscrire avec la même adresse e-mail." />
          {failed && <p className="text-base text-destructive">Vérification impossible pour le moment, réessayez.</p>}
          {blockers.length > 0 && (
            <BlockerBox title="Vous ne pouvez pas supprimer votre compte pour le moment" labels={blockers.map((b) => b.label)} />
          )}
          <label className="flex flex-col gap-2 text-base font-semibold">
            Tapez SUPPRIMER pour confirmer
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={disabled} className="h-12 text-base" />
          </label>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full h-12" disabled={disabled || !ok}>
                Demander la suppression de mon compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Dernière confirmation</AlertDialogTitle></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Retour</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    account.requestDeletion();
                    setTyped("");
                    toast.success("Votre demande est enregistrée. Un e-mail de confirmation vous a été envoyé (simulation).");
                  }}
                >
                  Confirmer la suppression
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      <AccountSimulationPanel account={account} showAdvance />
    </>
  );
}
