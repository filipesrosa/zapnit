ALTER TABLE "users" ADD COLUMN "client_token" TEXT NOT NULL DEFAULT '';
UPDATE "users" SET "client_token" = gen_random_uuid()::text WHERE "client_token" = '';
ALTER TABLE "users" ADD CONSTRAINT "users_client_token_key" UNIQUE ("client_token");

ALTER TABLE "baileys_instances" DROP CONSTRAINT IF EXISTS "baileys_instances_client_token_key";
ALTER TABLE "baileys_instances" DROP COLUMN IF EXISTS "client_token";
