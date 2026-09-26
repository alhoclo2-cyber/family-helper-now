import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { experienceBadge, type Request } from "@/lib/store";

type Props = {
  request: Request;
  hourlyRate?: number | null;
  serviceFee: number;
};

const money = (value: number) => `${value.toFixed(2).replace(".", ",")} €`;

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-3 border-b border-border last:border-b-0 min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold break-words ${value ? "text-foreground" : "text-muted-foreground"}`}>
        {value || "En attente"}
      </dd>
    </div>
  );
}

export function ReservationSummaryPanel({ request, hourlyRate, serviceFee }: Props) {
  const companion = request.student;
  const start = request.scheduledAt ? new Date(request.scheduledAt) : null;
  const end = request.scheduledAt && request.durationHours
    ? new Date(request.scheduledAt + request.durationHours * 60 * 60 * 1000)
    : null;
  const date = start && !Number.isNaN(start.getTime())
    ? `${new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(start)} · ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(start)}${end ? ` – ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(end)}` : ""}`
    : request.flow === "sos" || !request.scheduledAt ? "Dès que possible" : null;
  const childService = ["Garde d'enfants", "Aide aux devoirs", "Enfants de plus de 3 ans"].includes(request.need);
  const childCount = request.childrenCount || (request.childAges?.filter(Boolean).length
    ? `${request.childAges.filter(Boolean).length} enfant${request.childAges.filter(Boolean).length > 1 ? "s" : ""}`
    : request.childAge ? "1 enfant" : null);

  return (
    <Accordion type="single" collapsible className="w-full text-left">
      <AccordionItem value="reservation" className="rounded-md border border-border bg-card px-4">
        <AccordionTrigger className="min-h-12 text-base font-bold text-foreground no-underline hover:no-underline">
          Voir le détail de ma réservation
        </AccordionTrigger>
        <AccordionContent className="pt-1">
          <dl>
            <Detail label="Mode de réservation" value={request.scheduledAt ? "Prise de RDV" : "Besoin rapide"} />
            <Detail label="Service demandé" value={request.need} />
            <Detail label="Adresse de la mission" value={request.address?.trim()} />
            <Detail label="Date et horaires de la mission" value={date} />
            <Detail label="Précisions sur la mission" value={request.missionInfo?.trim()} />
            <Detail label="Informations complémentaires" value={request.extraInfo?.trim()} />
            {childService && <Detail label="Nombre d'enfants concernés" value={childCount} />}
            <div className="py-3 border-b border-border">
              <dt className="text-xs font-semibold text-muted-foreground">Compagnon</dt>
              <dd className="mt-2">
                {companion ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={companion.photo} alt={companion.firstName} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 text-sm font-semibold">
                      <span className="block">{companion.firstName}</span>
                      <span className="block text-xs text-muted-foreground">{experienceBadge(companion.missions).emoji} {experienceBadge(companion.missions).label}</span>
                    </span>
                  </div>
                ) : <span className="text-sm text-muted-foreground">En cours d'attribution</span>}
              </dd>
            </div>
            <Detail label="Salaire net horaire" value={hourlyRate != null && Number.isFinite(hourlyRate) && hourlyRate > 0 ? `${money(hourlyRate)}/h` : "En cours de définition"} />
            <Detail label="Frais de service Solélia" value={`${money(serviceFee)} fixes`} />
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}