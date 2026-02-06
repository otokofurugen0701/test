-- Add per-site threshold overrides
ALTER TABLE "Site" ADD COLUMN "fullThresholdOverride" INTEGER;
ALTER TABLE "Site" ADD COLUMN "lowBatteryThresholdOverride" INTEGER;
ALTER TABLE "Site" ADD COLUMN "offlineMinutesOverride" INTEGER;

-- Add per-device threshold overrides
ALTER TABLE "Device" ADD COLUMN "fullThresholdOverride" INTEGER;
ALTER TABLE "Device" ADD COLUMN "lowBatteryThresholdOverride" INTEGER;
ALTER TABLE "Device" ADD COLUMN "offlineMinutesOverride" INTEGER;
