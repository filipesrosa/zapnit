CREATE TABLE "baileys_messages" (
    "id"          TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "message_id"  TEXT,
    "origin"      TEXT NOT NULL DEFAULT 'api',
    "ip"          TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baileys_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "baileys_messages" ADD CONSTRAINT "baileys_messages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "baileys_messages" ADD CONSTRAINT "baileys_messages_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "baileys_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
