/** Champs « Date / lieu / département de naissance » partagés (Particulier, et plus tard Compagnon). */

const NAMES: [string, string][] = [
  ["01", "Ain"], ["02", "Aisne"], ["03", "Allier"], ["04", "Alpes-de-Haute-Provence"], ["05", "Hautes-Alpes"],
  ["06", "Alpes-Maritimes"], ["07", "Ardèche"], ["08", "Ardennes"], ["09", "Ariège"], ["10", "Aube"],
  ["11", "Aude"], ["12", "Aveyron"], ["13", "Bouches-du-Rhône"], ["14", "Calvados"], ["15", "Cantal"],
  ["16", "Charente"], ["17", "Charente-Maritime"], ["18", "Cher"], ["19", "Corrèze"], ["2A", "Corse-du-Sud"],
  ["2B", "Haute-Corse"], ["21", "Côte-d'Or"], ["22", "Côtes-d'Armor"], ["23", "Creuse"], ["24", "Dordogne"],
  ["25", "Doubs"], ["26", "Drôme"], ["27", "Eure"], ["28", "Eure-et-Loir"], ["29", "Finistère"],
  ["30", "Gard"], ["31", "Haute-Garonne"], ["32", "Gers"], ["33", "Gironde"], ["34", "Hérault"],
  ["35", "Ille-et-Vilaine"], ["36", "Indre"], ["37", "Indre-et-Loire"], ["38", "Isère"], ["39", "Jura"],
  ["40", "Landes"], ["41", "Loir-et-Cher"], ["42", "Loire"], ["43", "Haute-Loire"], ["44", "Loire-Atlantique"],
  ["45", "Loiret"], ["46", "Lot"], ["47", "Lot-et-Garonne"], ["48", "Lozère"], ["49", "Maine-et-Loire"],
  ["50", "Manche"], ["51", "Marne"], ["52", "Haute-Marne"], ["53", "Mayenne"], ["54", "Meurthe-et-Moselle"],
  ["55", "Meuse"], ["56", "Morbihan"], ["57", "Moselle"], ["58", "Nièvre"], ["59", "Nord"],
  ["60", "Oise"], ["61", "Orne"], ["62", "Pas-de-Calais"], ["63", "Puy-de-Dôme"], ["64", "Pyrénées-Atlantiques"],
  ["65", "Hautes-Pyrénées"], ["66", "Pyrénées-Orientales"], ["67", "Bas-Rhin"], ["68", "Haut-Rhin"], ["69", "Rhône"],
  ["70", "Haute-Saône"], ["71", "Saône-et-Loire"], ["72", "Sarthe"], ["73", "Savoie"], ["74", "Haute-Savoie"],
  ["75", "Paris"], ["76", "Seine-Maritime"], ["77", "Seine-et-Marne"], ["78", "Yvelines"], ["79", "Deux-Sèvres"],
  ["80", "Somme"], ["81", "Tarn"], ["82", "Tarn-et-Garonne"], ["83", "Var"], ["84", "Vaucluse"],
  ["85", "Vendée"], ["86", "Vienne"], ["87", "Haute-Vienne"], ["88", "Vosges"], ["89", "Yonne"],
  ["90", "Territoire de Belfort"], ["91", "Essonne"], ["92", "Hauts-de-Seine"], ["93", "Seine-Saint-Denis"],
  ["94", "Val-de-Marne"], ["95", "Val-d'Oise"], ["971", "Guadeloupe"], ["972", "Martinique"], ["973", "Guyane"],
  ["974", "La Réunion"], ["976", "Mayotte"], ["99", "Né(e) à l'étranger"],
];

export const DEPARTMENTS = NAMES.map(([code, name]) => ({ code, label: `${code} – ${name}` }));
export const departmentLabel = (code: string | null | undefined) =>
  DEPARTMENTS.find((d) => d.code === code)?.label ?? code ?? "";

export type BirthValue = { birthDate: string; birthPlace: string; birthDepartment: string };
export const EMPTY_BIRTH: BirthValue = { birthDate: "", birthPlace: "", birthDepartment: "" };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const isBirthDateValid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= todayIso() && v >= "1900-01-01";
export const isBirthComplete = (v: BirthValue) =>
  isBirthDateValid(v.birthDate) && !!v.birthPlace.trim() && DEPARTMENTS.some((d) => d.code === v.birthDepartment);

/** Affiche une date ISO (aaaa-mm-jj) au format jj/mm/aaaa. */
export const formatBirthDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

export function BirthFields({
  value,
  onChange,
  inputCls,
  showErrors,
}: {
  value: BirthValue;
  onChange: (v: BirthValue) => void;
  inputCls: string;
  showErrors?: boolean;
}) {
  const errCls = " border-destructive bg-destructive/5";
  const dateBad = !!value.birthDate && !isBirthDateValid(value.birthDate);
  const dateMissing = showErrors && !value.birthDate;
  const placeMissing = showErrors && !value.birthPlace.trim();
  const depMissing = showErrors && !value.birthDepartment;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-bold mb-1 block">Date de naissance</label>
        <input
          type="date"
          lang="fr"
          max={todayIso()}
          min="1900-01-01"
          value={value.birthDate}
          onChange={(e) => onChange({ ...value, birthDate: e.target.value })}
          className={inputCls + (dateBad || dateMissing ? errCls : "")}
        />
        {value.birthDate && !dateBad && (
          <p className="text-xs text-muted-foreground mt-1">{formatBirthDate(value.birthDate)}</p>
        )}
        {dateBad && (
          <p className="text-xs text-destructive font-semibold mt-1">La date de naissance ne peut pas être dans le futur.</p>
        )}
        {dateMissing && <p className="text-xs text-destructive font-semibold mt-1">Champ obligatoire</p>}
      </div>
      <div>
        <input
          placeholder="Lieu de naissance (commune)"
          autoComplete="off"
          value={value.birthPlace}
          onChange={(e) => onChange({ ...value, birthPlace: e.target.value })}
          className={inputCls + (placeMissing ? errCls : "")}
        />
        {placeMissing && <p className="text-xs text-destructive font-semibold mt-1">Champ obligatoire</p>}
      </div>
      <div>
        <select
          aria-label="Département de naissance"
          value={value.birthDepartment}
          onChange={(e) => onChange({ ...value, birthDepartment: e.target.value })}
          className={inputCls + (depMissing ? errCls : "")}
        >
          <option value="">Département de naissance</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.code} value={d.code}>
              {d.label}
            </option>
          ))}
        </select>
        {depMissing && <p className="text-xs text-destructive font-semibold mt-1">Champ obligatoire</p>}
      </div>
    </div>
  );
}
