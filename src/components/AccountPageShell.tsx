import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { useSession } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

/** Mise en page commune des pages Compte (même gabarit que PlaceholderPage). */
export function AccountPageShell({ title, children }: { title: string; children: (s: Session) => ReactNode }) {
  const { session, loading } = useSession();
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <Toaster />
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl px-5 py-8 gap-6">
        <Link to="/" className="text-sm font-bold text-primary">← Retour à l'accueil</Link>
        <h1 className="text-2xl font-black">{title}</h1>
        {loading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : !session ? (
          <p className="text-base">
            Connectez-vous pour accéder à cette page.{" "}
            <Link to="/auth" className="font-semibold text-primary underline">Se connecter</Link>
          </p>
        ) : (
          children(session)
        )}
      </div>
    </div>
  );
}

export function BlockerBox({ title, labels }: { title: string; labels: string[] }) {
  return (
    <div className="rounded-2xl border-2 border-destructive bg-card p-4 text-base">
      <p className="font-bold text-destructive">{title}</p>
      <ul className="mt-2 list-disc pl-5">
        {labels.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </div>
  );
}
