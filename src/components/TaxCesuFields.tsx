/** Champs « Numéro fiscal » et « Numéro CESU » partagés (inscription + espace Client). */

export const cleanTaxNumber = (v: string) => v.replace(/\s/g, "");
export const isTaxNumberValid = (v: string) => /^\d{13}$/.test(cleanTaxNumber(v));

/** Question Oui / Non (une seule case cochable, aucune présélection). */
export function YesNoChoice({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  invalid?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-bold mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {([
          [true, "Oui"],
          [false, "Non"],
        ] as const).map(([v, l]) => (
          <label
            key={l}
            className={`flex items-center gap-2 py-3 px-4 rounded-2xl border-2 cursor-pointer text-sm font-bold ${
              value === v
                ? "border-primary bg-accent"
                : invalid
                  ? "border-destructive bg-destructive/5"
                  : "border-border bg-card"
            }`}
          >
            <input
              type="checkbox"
              checked={value === v}
              onChange={() => onChange(v)}
              className="accent-primary w-4 h-4"
            />
            {l}
          </label>
        ))}
      </div>
    </div>
  );
}

export type TaxCesuValue = { taxNumber: string; hasCesu: boolean | null; cesuNumber: string };

export function TaxCesuFields({
  value,
  onChange,
  inputCls,
  showErrors,
}: {
  value: TaxCesuValue;
  onChange: (v: TaxCesuValue) => void;
  inputCls: string;
  showErrors?: boolean;
}) {
  const taxBad = !!value.taxNumber.trim() && !isTaxNumberValid(value.taxNumber);
  const taxMissing = showErrors && !value.taxNumber.trim();
  const cesuMissing = showErrors && value.hasCesu === true && !value.cesuNumber.trim();
  return (
    <div className="flex flex-col gap-3">
      <div>
        <input
          placeholder="Numéro fiscal (13 chiffres)"
          inputMode="numeric"
          autoComplete="off"
          value={value.taxNumber}
          onChange={(e) => onChange({ ...value, taxNumber: e.target.value.replace(/[^\d\s]/g, "").slice(0, 20) })}
          className={inputCls + (taxBad || taxMissing ? " border-destructive bg-destructive/5" : "")}
        />
        {taxBad && (
          <p className="text-xs text-destructive font-semibold mt-1">Le numéro fiscal doit comporter 13 chiffres.</p>
        )}
        {taxMissing && <p className="text-xs text-destructive font-semibold mt-1">Champ obligatoire</p>}
      </div>
      <YesNoChoice
        label="Avez-vous un numéro CESU ?"
        value={value.hasCesu}
        onChange={(v) => onChange({ ...value, hasCesu: v, cesuNumber: v ? value.cesuNumber : "" })}
        invalid={showErrors && value.hasCesu === null}
      />
      {value.hasCesu === true && (
        <div>
          <input
            placeholder="Numéro CESU"
            autoComplete="off"
            value={value.cesuNumber}
            onChange={(e) => onChange({ ...value, cesuNumber: e.target.value })}
            className={inputCls + (cesuMissing ? " border-destructive bg-destructive/5" : "")}
          />
          {cesuMissing && <p className="text-xs text-destructive font-semibold mt-1">Champ obligatoire</p>}
        </div>
      )}
    </div>
  );
}

export function isTaxCesuComplete(v: TaxCesuValue) {
  return isTaxNumberValid(v.taxNumber) && v.hasCesu !== null && (!v.hasCesu || !!v.cesuNumber.trim());
}
