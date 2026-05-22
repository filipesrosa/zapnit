-- AlterTable
ALTER TABLE "baileys_instances" ADD COLUMN "ai_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "baileys_instances" ADD COLUMN "ai_system_prompt" TEXT;
ALTER TABLE "baileys_instances" ADD COLUMN "qr_code_detection" BOOLEAN NOT NULL DEFAULT false;
