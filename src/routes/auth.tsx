import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Solélia" },
      {
        name: "description",
        content:
          "Connectez-vous ou créez votre compte Solélia pour réserver une présence à domicile ou devenir compagnon.",
      },
      { property: "og:title", content: "Connexion — Solélia" },
      { property: "og:description", content: "Accédez à votre espace Solélia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl px-5 py-8 gap-6">
        <Link to="/" className="text-sm font-bold text-primary">
          ← Retour à l'accueil
        </Link>
        <AuthCard
          title="Mon espace Solélia"
          subtitle="Particuliers et compagnons"
          onSuccess={() => navigate({ to: "/", replace: true })}
        />
      </div>
    </div>
  );
}
