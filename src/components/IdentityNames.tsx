import { useState } from "react";

type Names = { firstName: string; lastName: string; birthName: string };

/** lastName est le nom d'usage ; birthName est le nom de naissance. */
export function IdentityNames({ value, onChange, inputClass, required = false, showErrors = false }: {
  value: Names;
  onChange: (value: Names) => void;
  inputClass: string;
  required?: boolean;
  showErrors?: boolean;
}) {
  const [same, setSame] = useState(false);
  const field = (key: keyof Names, placeholder: string, optionalForExisting = false) => {
    const invalid = showErrors && !optionalForExisting && !value[key].trim();
    return (
      <div className="min-w-0 flex flex-col">
        <input aria-label={placeholder} placeholder={placeholder} required={required} value={value[key]}
          onChange={(e) => {
            const next = e.target.value;
            if (key === "birthName") setSame(false);
            onChange({ ...value, [key]: next, ...(key === "lastName" && same ? { birthName: next } : {}) });
          }}
          className={`${inputClass} w-full min-w-0${invalid ? " border-destructive bg-destructive/5" : ""}`} />
        {invalid && <p className="text-xs text-destructive font-semibold mt-1">Champ obligatoire</p>}
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {field("firstName", "Prénom")}
        {field("lastName", "Nom d'usage")}
      </div>
      {field("birthName", "Nom de naissance", !required && !showErrors)}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={same} className="mt-1 shrink-0 accent-primary" onChange={(e) => {
          setSame(e.target.checked);
          if (e.target.checked) onChange({ ...value, birthName: value.lastName });
        }} />
        <span>Mon nom de naissance est identique à mon nom d'usage</span>
      </label>
    </div>
  );
}