import type { ContractDocument } from "@/lib/contractDocument";

export function FinalContractDocument({ document: doc }: { document: ContractDocument }) {
  return <div className="flex flex-col gap-4 text-base break-words">
    <h2 className="text-xl font-black">{doc.title}</h2>
    <p>Convention collective IDCC {doc.idcc}</p>
    {[{ title: "L'employeur", fields: doc.employer }, { title: "Le salarié", fields: doc.companion }].map(p => <section key={p.title}>
      <h3 className="font-black mb-2">{p.title}</h3>
      {p.fields.map(f => <p key={f.label}><b>{f.label} :</b> {f.value || "—"}</p>)}
    </section>)}
    {doc.sections.map(s => <details key={s.key} open className="border-b border-border pb-4">
      <summary className="font-black cursor-pointer">{s.number}. {s.title}</summary>
      <div className="mt-2 space-y-2">{s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
    </details>)}
    {doc.signatureLine && <p className="font-bold border-t border-border pt-4">{doc.signatureLine}</p>}
  </div>;
}