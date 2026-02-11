import { AlertSeverity, AlertStatus, AlertType, Prisma, type Device } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isOffline } from "@/lib/settings";

const OPEN_STATUSES: AlertStatus[] = [AlertStatus.OPEN, AlertStatus.IN_PROGRESS];

export async function upsertThresholdAlert(params: {
  deviceId: string;
  type: AlertType;
  active: boolean;
  severity: AlertSeverity;
  details?: Record<string, unknown>;
}) {
  const { deviceId, type, active, severity, details } = params;
  const existing = await prisma.alert.findFirst({
    where: { deviceId, type, status: { in: OPEN_STATUSES } },
  });

  if (active) {
    if (existing) {
      return prisma.alert.update({
        where: { id: existing.id },
        data: {
          lastEventAt: new Date(),
          severity,
          detailsJson: details as Prisma.InputJsonValue | undefined,
        },
      });
    }
    return prisma.alert.create({
      data: {
        deviceId,
        type,
        severity,
        status: AlertStatus.OPEN,
        openedAt: new Date(),
        lastEventAt: new Date(),
        detailsJson: details as Prisma.InputJsonValue | undefined,
      },
    });
  }

  if (existing) {
    return prisma.alert.update({
      where: { id: existing.id },
      data: {
        status: AlertStatus.RESOLVED,
        closedAt: new Date(),
      },
    });
  }

  return null;
}

export async function syncOfflineAlert(device: Pick<Device, "id" | "lastSeenAt">, isOffline: boolean) {
  const existing = await prisma.alert.findFirst({
    where: {
      deviceId: device.id,
      type: AlertType.OFFLINE,
      status: { in: OPEN_STATUSES },
    },
  });

  if (isOffline) {
    if (existing) {
      return prisma.alert.update({
        where: { id: existing.id },
        data: { lastEventAt: new Date() },
      });
    }
    return prisma.alert.create({
      data: {
        deviceId: device.id,
        type: AlertType.OFFLINE,
        severity: AlertSeverity.HIGH,
        status: AlertStatus.OPEN,
        openedAt: new Date(),
        lastEventAt: new Date(),
        detailsJson: { lastSeenAt: device.lastSeenAt },
      },
    });
  }

  if (existing) {
    return prisma.alert.update({
      where: { id: existing.id },
      data: { status: AlertStatus.RESOLVED, closedAt: new Date() },
    });
  }

  return null;
}

export async function syncOfflineAlertsForDevices(
  devices: Array<Pick<Device, "id" | "lastSeenAt">>,
  offlineMinutes: number
) {
  for (const device of devices) {
    await syncOfflineAlert(device, isOffline(device.lastSeenAt, offlineMinutes));
  }
}
