import { Link } from "@tanstack/react-router";
import { useSession } from "@/lib/auth";
import { formatDateFr, useAccountState } from "@/lib/accountState";

export function AccountStatusBanner() {
  const { session } = useSession();
  const { state } = useAccountState(session?.user.id);
  if (!session) return null;
  if (state.status === "paused")
    return (
      <div className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm">
        Votre compte est en pause.{" "}
        <Link to="/compte/pause" className="font-semibold text-primary underline">Réactiver</Link>
      </div>
    );
  if (state.status === "deletion_pending")
    return (
      <div className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm">
        Suppression de votre compte prévue le {formatDateFr(state.deletionEffectiveAt)}.{" "}
        <Link to="/compte/suppression" className="font-semibold text-primary underline">Annuler la suppression</Link>
      </div>
    );
  return null;
}
