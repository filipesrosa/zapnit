-- Instance activation status + trial + sleep fields
ALTER TABLE "baileys_instances"
  ADD COLUMN "activation_status"    TEXT          NOT NULL DEFAULT 'trial',
  ADD COLUMN "trial_ends_at"        TIMESTAMP(3)  NOT NULL DEFAULT NOW() + INTERVAL '2 days',
  ADD COLUMN "trial_warning_sent_at" TIMESTAMP(3),
  ADD COLUMN "last_activity_at"     TIMESTAMP(3),
  ADD COLUMN "sleeping"             BOOLEAN       NOT NULL DEFAULT false;

ALTER TABLE "wppweb_instances"
  ADD COLUMN "activation_status"    TEXT          NOT NULL DEFAULT 'trial',
  ADD COLUMN "trial_ends_at"        TIMESTAMP(3)  NOT NULL DEFAULT NOW() + INTERVAL '2 days',
  ADD COLUMN "trial_warning_sent_at" TIMESTAMP(3),
  ADD COLUMN "last_activity_at"     TIMESTAMP(3),
  ADD COLUMN "sleeping"             BOOLEAN       NOT NULL DEFAULT false;

-- Billing warning tracking
ALTER TABLE "tenants"
  ADD COLUMN "last_billing_warning_at" TIMESTAMP(3);

-- Message status tracking
ALTER TABLE "baileys_messages"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'queued',
  ADD COLUMN "error"  TEXT;

ALTER TABLE "wppweb_messages"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'queued',
  ADD COLUMN "error"  TEXT;

-- System config (single-row, trial watermark text)
CREATE TABLE "system_config" (
  "id"             TEXT          NOT NULL DEFAULT 'default',
  "trial_watermark" TEXT         NOT NULL DEFAULT '_Enviado via Zapnit Trial — zapnit.com_',
  "updated_at"     TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);
INSERT INTO "system_config" ("id", "trial_watermark", "updated_at")
VALUES ('default', '_Enviado via Zapnit Trial — zapnit.com_', NOW())
ON CONFLICT DO NOTHING;

-- Backfill: existing instances were created before the trial system — mark all active
UPDATE "baileys_instances" SET "activation_status" = 'active';
UPDATE "wppweb_instances"  SET "activation_status" = 'active';
