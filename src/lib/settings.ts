import { prisma } from "@/lib/db";

export type Thresholds = {
  fullThreshold: number;
  lowBatteryThreshold: number;
  offlineMinutes: number;
};

const DEFAULTS: Thresholds = {
  fullThreshold: 85,
  lowBatteryThreshold: 20,
  offlineMinutes: 30,
};

export async function getThresholds(): Promise<Thresholds> {
  const settings = await prisma.settings.findFirst();
  if (!settings) {
    await prisma.settings.create({ data: DEFAULTS });
    return DEFAULTS;
  }
  return {
    fullThreshold: settings.fullThreshold,
    lowBatteryThreshold: settings.lowBatteryThreshold,
    offlineMinutes: settings.offlineMinutes,
  };
}

export function isOffline(lastSeenAt: Date | null | undefined, offlineMinutes: number) {
  if (!lastSeenAt) return true;
  const cutoff = Date.now() - offlineMinutes * 60 * 1000;
  return lastSeenAt.getTime() < cutoff;
}
