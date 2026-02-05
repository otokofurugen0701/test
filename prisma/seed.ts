import { PrismaClient, Role, AlertStatus, AlertType, AlertSeverity, TaskStatus, TaskType, DeviceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.telemetry.deleteMany();
  await prisma.device.deleteMany();
  await prisma.site.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const [admin, operator] = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@smagomi.local",
        name: "Admin User",
        passwordHash,
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: "operator@smagomi.local",
        name: "Operator User",
        passwordHash,
        role: Role.OPERATOR,
      },
    }),
  ]);

  await prisma.settings.create({
    data: {
      fullThreshold: 85,
      lowBatteryThreshold: 20,
      offlineMinutes: 30,
    },
  });

  const siteA = await prisma.site.create({
    data: {
      name: "渋谷駅周辺エリア",
      address: "東京都渋谷区道玄坂1-1-1",
      lat: 35.658034,
      lng: 139.701636,
      notes: "駅前の設置",
    },
  });

  const siteB = await prisma.site.create({
    data: {
      name: "品川港湾エリア",
      address: "東京都港区港南2-18-1",
      lat: 35.628471,
      lng: 139.73876,
      notes: "屋外設置（潮風）",
    },
  });

  const device1 = await prisma.device.create({
    data: {
      deviceCode: "SMG-0001",
      name: "渋谷01",
      siteId: siteA.id,
      installedAt: daysAgo(120),
      status: DeviceStatus.ACTIVE,
      responsibleUserId: admin.id,
      lastSeenAt: hoursAgo(1),
      lastFillLevelPct: 92,
      lastBatteryPct: 48,
      lastDoorOpen: false,
      lastTempC: 23.1,
      lastRssi: -65.2,
      notes: "繁華街のため満杯になりやすい",
    },
  });

  const device2 = await prisma.device.create({
    data: {
      deviceCode: "SMG-0002",
      name: "港南02",
      siteId: siteB.id,
      installedAt: daysAgo(60),
      status: DeviceStatus.ACTIVE,
      responsibleUserId: operator.id,
      lastSeenAt: hoursAgo(2),
      lastFillLevelPct: 40,
      lastBatteryPct: 15,
      lastDoorOpen: true,
      lastTempC: 19.4,
      lastRssi: -80.5,
      notes: "バッテリー劣化気味",
    },
  });

  const telemetryForDevice1 = Array.from({ length: 28 }).map((_, idx) => {
    const ts = hoursAgo(6 * (27 - idx));
    const fill = Math.min(100, 30 + idx * 2);
    const battery = Math.max(15, 60 - idx);
    return {
      deviceId: device1.id,
      ts,
      fillLevelPct: fill,
      batteryPct: battery,
      doorOpen: false,
      tempC: 22 + (idx % 5),
      rssi: -60 - idx,
    };
  });

  const telemetryForDevice2 = Array.from({ length: 28 }).map((_, idx) => {
    const ts = hoursAgo(6 * (27 - idx));
    const fill = Math.min(100, 20 + idx);
    const battery = Math.max(5, 35 - idx);
    return {
      deviceId: device2.id,
      ts,
      fillLevelPct: fill,
      batteryPct: battery,
      doorOpen: idx % 7 === 0,
      tempC: 18 + (idx % 4),
      rssi: -70 - idx,
    };
  });

  await prisma.telemetry.createMany({
    data: [...telemetryForDevice1, ...telemetryForDevice2],
  });

  const fullAlert = await prisma.alert.create({
    data: {
      deviceId: device1.id,
      type: AlertType.FULL,
      severity: AlertSeverity.HIGH,
      status: AlertStatus.OPEN,
      openedAt: hoursAgo(2),
      lastEventAt: hoursAgo(1),
      detailsJson: { reason: "fill_level_pct >= 85", current: 92 },
    },
  });

  const batteryAlert = await prisma.alert.create({
    data: {
      deviceId: device2.id,
      type: AlertType.LOW_BATTERY,
      severity: AlertSeverity.MEDIUM,
      status: AlertStatus.IN_PROGRESS,
      openedAt: hoursAgo(10),
      lastEventAt: hoursAgo(2),
      detailsJson: { reason: "battery_pct <= 20", current: 15 },
    },
  });

  await prisma.task.createMany({
    data: [
      {
        deviceId: device1.id,
        alertId: fullAlert.id,
        type: TaskType.COLLECTION,
        status: TaskStatus.TODO,
        assigneeUserId: operator.id,
        dueAt: hoursAgo(-6),
        notes: "夜間回収予定",
      },
      {
        deviceId: device2.id,
        alertId: batteryAlert.id,
        type: TaskType.MAINTENANCE,
        status: TaskStatus.IN_PROGRESS,
        assigneeUserId: admin.id,
        dueAt: hoursAgo(-24),
        notes: "バッテリー交換の手配",
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
