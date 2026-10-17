import { useEffect, useId, useState } from "react";
import { arrivalTimeToday, checkArrival, formatArrivalTime, type Arrival } from "@/lib/arrival";

export function useArrivalInput(durationHours: number) {
  const [time, setTime] = useState("");
  const [travel, setTravel] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const arrival: Arrival = { arrivalAt: arrivalTimeToday(time, now), travelMinutes: Number(travel) };
  const complete = time !== "" && travel !== "" && now > 0;
  const check = complete ? checkArrival({ ...arrival, durationHours, now }) : null;
  const valid = check?.ok === true;
  const error = complete ? check?.error : "Indiquez votre heure d'arrivée et votre temps de trajet.";
  const summary = valid && check ? `Départ à ${formatArrivalTime(check.departAt)} · arrivée à ${formatArrivalTime(arrival.arrivalAt)} · fin prévue à ${formatArrivalTime(check.endAt)}` : null;
  return { time, setTime, travel, setTravel, arrival, valid, error, summary };
}

export function ArrivalFields({ input }: { input: ReturnType<typeof useArrivalInput> }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3 text-left text-base">
      <label htmlFor={`${id}-time`} className="font-semibold">À quelle heure arrivez-vous chez le particulier ?</label>
      <input id={`${id}-time`} type="time" required value={input.time} onChange={(e) => input.setTime(e.target.value)} className="min-h-12 w-full min-w-0 rounded-xl border-2 border-border bg-background px-3 text-foreground" />
      <label htmlFor={`${id}-travel`} className="font-semibold">Combien de temps de trajet ?</label>
      <input id={`${id}-travel`} type="number" min={0} step={1} required value={input.travel} onChange={(e) => input.setTravel(e.target.value)} className="min-h-12 w-full min-w-0 rounded-xl border-2 border-border bg-background px-3 text-foreground" />
      {input.error && <p role="alert" className="text-destructive">{input.error}</p>}
      {input.summary && <p role="status" className="text-success">{input.summary}</p>}
    </div>
  );
}