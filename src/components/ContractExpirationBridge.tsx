import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { expireOverdueContracts } from "@/lib/contract.functions";
import { importSimulatedEmail } from "@/lib/simulatedEmails";

/** Autonomous expiration is SQL scheduled; this only refreshes signed-in views and inboxes. */
export function ContractExpirationBridge() {
  const { session } = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const expire = useServerFn(expireOverdueContracts);
  useEffect(() => {
    if (!userId) return;
    void expire().then(() => qc.invalidateQueries({ queryKey: ["my-contracts", userId] })).catch(() => undefined);
  }, [userId, expire, qc]);
  const emails = useQuery({
    queryKey: ["contract-expiration-emails", userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("contract_expiration_emails")
        .select("id,subject,body,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    for (const email of emails.data ?? []) importSimulatedEmail({
      id: email.id, kind: "contract_expired", to: session?.user.email ?? "",
      subject: email.subject, body: email.body, createdAt: new Date(email.created_at).getTime(),
      linkLabel: "Mes contrats", linkTo: "/compte/contrats",
    });
  }, [emails.data, session?.user.email]);
  return null;
}