-- CreateTable
CREATE TABLE "baileys_instances" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "wa_number" TEXT,
    "wa_name" TEXT,
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baileys_instances_pkey" PRIMARY KEY ("id")
);
