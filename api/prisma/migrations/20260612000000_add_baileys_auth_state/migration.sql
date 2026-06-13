-- CreateTable
CREATE TABLE "baileys_auth_state" (
    "instance_id" TEXT NOT NULL,
    "category"    TEXT NOT NULL,
    "key_id"      TEXT NOT NULL,
    "data"        TEXT NOT NULL,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baileys_auth_state_pkey" PRIMARY KEY ("instance_id", "category", "key_id")
);

-- AddForeignKey
ALTER TABLE "baileys_auth_state" ADD CONSTRAINT "baileys_auth_state_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "baileys_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
