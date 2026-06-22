-- CreateTable
CREATE TABLE "wppweb_instances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "wa_number" TEXT,
    "wa_name" TEXT,
    "connected_at" TIMESTAMP(3),
    "webhook_url" TEXT,
    "webhook_events" TEXT[],
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_system_prompt" TEXT,
    "qr_code_detection" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wppweb_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wppweb_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "message_id" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'api',
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wppweb_messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "wppweb_instances" ADD CONSTRAINT "wppweb_instances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wppweb_messages" ADD CONSTRAINT "wppweb_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wppweb_messages" ADD CONSTRAINT "wppweb_messages_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "wppweb_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
