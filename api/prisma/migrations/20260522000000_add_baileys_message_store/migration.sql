CREATE TABLE "baileys_message_store" (
    "instance_id" TEXT NOT NULL,
    "message_id"  TEXT NOT NULL,
    "content"     JSONB NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baileys_message_store_pkey" PRIMARY KEY ("instance_id", "message_id")
);

ALTER TABLE "baileys_message_store" ADD CONSTRAINT "baileys_message_store_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "baileys_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
