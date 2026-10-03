import { createFileRoute, Link } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AccountPageShell, BlockerBox } from "@/components/AccountPageShell";
import { AccountSimulationPanel } from "@/components/AccountSimulationPanel";
import { formatDateFr, useAccountState } from "@/lib/accountState";
import { useAccountBlockers, useAccountRole } from "@/lib/accountBlockers";

export const Route = createFileRoute("/compte/pause")({
  head: () => ({
    meta: [
      { title: "Mettre en pause mon compte — Solélia" },
      { name: "description", content: "Mettez temporairement votre compte Solélia en pause." },
      { property: "og:title", content: "Mettre en pause mon compte — Solélia" },
      { property: "og:description", content: "Pause temporaire de votre compte Solélia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AccountPageShell title="Mettre en pause mon compte">{(s) => <PauseContent session={s} />}</AccountPageShell>
  ),
});

function PauseContent({ session }: { session: Session }) {
  const uid = session.user.id;
  const account = useAccountState(uid);
  const role = useAccountRole(uid);
  const { loading, error, blockers } = useAccountBlockers(uid, role.data, account.state.sim);
  const { state } = account;
  const failed = error || role.isError;

  return (
    <>
      {state.status === "paused" ? (
        <div className="flex flex-col gap-4">
          <p className="text-base">Votre compte est en pause depuis le {formatDateFr(state.pausedAt)}.</p>
          <Button className="w-full h-12" onClick={() => { account.reactivate(); toast.success("Votre compte est de nouveau actif."); }}>
            Réactiver mon compte
          </Button>
        </div>
      ) : state.status === "deletion_pending" ? (
        <p className="text-base">
          Une suppression de votre compte est en cours. Annulez-la d'abord pour pouvoir utiliser la pause.{" "}
          <Link to="/compte/suppression" className="font-semibold text-primary underline">Voir la suppression</Link>
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-base">
            {role.data === "companion"
              ? "Pendant la pause, vous n'apparaissez plus dans les recherches et vous ne recevez plus de demandes. Vos informations et vos documents sont conservés. Vous pouvez réactiver votre compte à tout moment, en un clic."
              : "Pendant la pause, vous ne pouvez plus réserver de service. Vos informations et vos documents sont conservés. Vous pouvez réactiver votre compte à tout moment, en un clic."}
          </p>
          {failed && <p className="text-base text-destructive">Vérification impossible pour le moment, réessayez.</p>}
          {blockers.length > 0 && (
            <BlockerBox title="Vous ne pouvez pas mettre votre compte en pause pour le moment" labels={blockers.map((b) => b.label)} />
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full h-12" disabled={loading || role.isLoading || failed || blockers.length > 0}>
                Mettre mon compte en pause
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Confirmer la mise en pause ?</AlertDialogTitle></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Retour</AlertDialogCancel>
                <AlertDialogAction onClick={() => { account.pause(); toast.success("Votre compte est en pause."); }}>
                  Confirmer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      <AccountSimulationPanel account={account} />
    </>
  );
}
