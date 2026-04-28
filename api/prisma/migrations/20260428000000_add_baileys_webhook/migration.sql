ALTER TABLE "baileys_instances"
  ADD COLUMN "webhook_url" TEXT,
  ADD COLUMN "webhook_events" TEXT[] NOT NULL DEFAULT '{}';
