import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/hooks/expire-contracts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        // No managed cron credential is provisioned here: fail closed like any
        // unverified caller, rather than emitting a server error to the preview.
        if (denied) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("expire_overdue_contracts");
        if (error) return Response.json({ error: "Expiration indisponible" }, { status: 500 });
        return Response.json({ count: data?.length ?? 0 });
      },
    },
  },
});