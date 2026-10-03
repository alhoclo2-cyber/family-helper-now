import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { clearEmails, useSimulatedEmails } from "@/lib/simulatedEmails";

const fmt = (ts: number) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(ts));

export function SimulatedEmailsDialog() {
  const emails = useSimulatedEmails();
  const list = [...emails].reverse();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-12 text-base">📧 E-mails de démonstration</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>E-mails de démonstration</DialogTitle>
        </DialogHeader>
        {list.length === 0 ? (
          <p className="text-base text-muted-foreground">Aucun e-mail pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-card p-3 text-base">
                <p className="text-sm text-muted-foreground">À : {m.to} — {fmt(m.createdAt)}</p>
                <p className="font-bold">{m.subject}</p>
                <p className="mt-1 whitespace-pre-line">{m.body}</p>
                {m.linkTo && m.linkLabel && (
                  <Link to={m.linkTo} className="mt-2 inline-block font-semibold text-primary underline">
                    {m.linkLabel}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" className="w-full h-12" onClick={clearEmails}>Vider la liste</Button>
      </DialogContent>
    </Dialog>
  );
}
