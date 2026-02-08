import { prisma } from "@/lib/db";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const settings = await prisma.settings.findFirst();
  const taskTemplatesText = settings?.taskTemplatesJson
    ? JSON.stringify(settings.taskTemplatesJson, null, 2)
    : undefined;
  const alertTemplatesText = settings?.alertTemplatesJson
    ? JSON.stringify(settings.alertTemplatesJson, null, 2)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-600">満杯・電池低下・通信断の閾値設定</p>
      </div>

      <SettingsForm
        fullThreshold={settings?.fullThreshold ?? 85}
        lowBatteryThreshold={settings?.lowBatteryThreshold ?? 20}
        offlineMinutes={settings?.offlineMinutes ?? 30}
        taskTemplatesText={taskTemplatesText}
        alertTemplatesText={alertTemplatesText}
      />
    </div>
  );
}
