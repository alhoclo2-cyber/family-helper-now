import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/archives")({
  head: () => ({
    meta: [
      { title: "Mes archives — Solélia" },
      { name: "description", content: "Retrouvez l'historique de vos missions Solélia." },
      { property: "og:title", content: "Mes archives — Solélia" },
      { property: "og:description", content: "Accédez à vos archives Solélia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PlaceholderPage title="Mes archives" />,
});
