import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

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
  component: () => <PlaceholderPage title="Mettre en pause mon compte" requireAuth />,
});
