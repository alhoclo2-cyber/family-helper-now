import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

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
  component: () => <PlaceholderPage title="Supprimer mon compte" requireAuth />,
});
