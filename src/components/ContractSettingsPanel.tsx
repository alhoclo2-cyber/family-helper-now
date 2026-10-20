import { Switch } from "@/components/ui/switch";
import { useAppSetting, useUpdateAppSetting, type AppSettingKey } from "@/lib/appSettings";

function Setting({ settingKey, defaultValue, label }: { settingKey: AppSettingKey; defaultValue: boolean; label: string }) {
  const setting = useAppSetting(settingKey, defaultValue);
  const update = useUpdateAppSetting();
  return (
    <div>
      <label className="flex items-center justify-between gap-3 py-2 text-sm font-semibold">
        <span>{label}</span>
        <Switch aria-label={label} checked={setting.data ?? defaultValue}
          disabled={!setting.isSuccess || update.isPending}
          onCheckedChange={(value) => update.mutate({ key: settingKey, value })} />
      </label>
      {(setting.isError || update.isError) && <p className="text-xs text-destructive">Impossible de mettre à jour ce réglage. Réessayez.</p>}
    </div>
  );
}

export function ContractSettingsPanel() {
  return (
    <section className="border-2 border-border rounded-2xl p-4">
      <h2 className="font-bold text-sm mb-2">Paramètres du contrat</h2>
      <Setting settingKey="contract_flow_enabled" defaultValue={false} label="Activer le parcours contrat" />
      <Setting settingKey="contract_convalescence_enabled" defaultValue={true} label="Autoriser le motif convalescence (CDD)" />
    </section>
  );
}