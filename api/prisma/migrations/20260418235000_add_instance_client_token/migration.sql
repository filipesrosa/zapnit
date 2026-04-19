ALTER TABLE "baileys_instances" ADD COLUMN "client_token" TEXT NOT NULL DEFAULT '';
UPDATE "baileys_instances" SET "client_token" = gen_random_uuid()::text WHERE "client_token" = '';
ALTER TABLE "baileys_instances" ADD CONSTRAINT "baileys_instances_client_token_key" UNIQUE ("client_token");
