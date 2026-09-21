import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/hooks/charge-due-payments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { processDuePayments } = await import("@/lib/payments.server");
        try {
          const result = await processDuePayments();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Erreur inconnue";
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
