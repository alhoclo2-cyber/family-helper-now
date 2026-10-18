import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";
import { useStore } from "@/lib/store";

export function FamilyAcceptanceBanner() {
  const navigate = useNavigate();
  const { session } = useSession();
  // The current request is the family's selection, never a companion's list item.
  const request = useStore((s) => s.requests.find((r) => r.id === s.currentRequestId));
  if (!session || !request || request.demo || request.scheduledAt || request.status !== "accepted" || request.acknowledged) return null;
  return (
    <aside role="status" className="sticky top-0 z-50 mx-auto flex w-full max-w-[440px] items-center gap-3 border-b-2 border-primary bg-accent px-4 py-3 text-foreground shadow-sm">
      <p className="min-w-0 flex-1 text-sm font-bold">Un compagnon a accepté votre demande, merci de répondre dans les 5 min.</p>
      <Button type="button" className="shrink-0" onClick={() => navigate({ to: "/", search: { respond: request.id, responseAt: Date.now() } })}>Voir</Button>
    </aside>
  );
}