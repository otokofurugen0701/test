import { prisma } from "@/lib/db";

export type Thresholds = {
  fullThreshold: number;
  lowBatteryThreshold: number;
  offlineMinutes: number;
};

export type ThresholdOverrideSource = {
  fullThresholdOverride?: number | null;
  lowBatteryThresholdOverride?: number | null;
  offlineMinutesOverride?: number | null;
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

export function resolveThresholds(base: Thresholds, sources: ThresholdOverrideSource[]) {
  const resolved = { ...base };
  for (const source of sources) {
    if (source?.fullThresholdOverride !== null && source?.fullThresholdOverride !== undefined) {
      resolved.fullThreshold = source.fullThresholdOverride;
    }
    if (source?.lowBatteryThresholdOverride !== null && source?.lowBatteryThresholdOverride !== undefined) {
      resolved.lowBatteryThreshold = source.lowBatteryThresholdOverride;
    }
    if (source?.offlineMinutesOverride !== null && source?.offlineMinutesOverride !== undefined) {
      resolved.offlineMinutes = source.offlineMinutesOverride;
    }
  }
  return resolved;
}

export function isOffline(lastSeenAt: Date | null | undefined, offlineMinutes: number) {
  if (!lastSeenAt) return true;
  const cutoff = Date.now() - offlineMinutes * 60 * 1000;
  return lastSeenAt.getTime() < cutoff;
}
