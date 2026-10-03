import { Link } from "@tanstack/react-router";
import { useSession } from "@/lib/auth";

export function PlaceholderPage({ title, requireAuth }: { title: string; requireAuth?: boolean }) {
  const { session, loading } = useSession();
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl px-5 py-8 gap-6">
        <Link to="/" className="text-sm font-bold text-primary">
          ← Retour à l'accueil
        </Link>
        <h1 className="text-2xl font-black">{title}</h1>
        {requireAuth && loading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : requireAuth && !session ? (
          <p className="text-base">
            Connectez-vous pour accéder à cette page.{" "}
            <Link to="/auth" className="font-semibold text-primary underline">Se connecter</Link>
          </p>
        ) : (
          <p className="text-base text-muted-foreground">Cette page sera disponible prochainement.</p>
        )}
      </div>
    </div>
  );
}
