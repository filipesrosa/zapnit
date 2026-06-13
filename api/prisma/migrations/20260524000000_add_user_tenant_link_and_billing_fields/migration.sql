-- AlterTable: add billing fields to tenants
ALTER TABLE "tenants" ADD COLUMN "gateway_customer_id" TEXT,
ADD COLUMN "gateway_subscription_id" TEXT,
ADD COLUMN "gateway_price_id" TEXT,
ADD COLUMN "payment_status" TEXT,
ADD COLUMN "billing_cycle_end" TIMESTAMP(3);

-- AlterTable: add gateway_price_id to plans
ALTER TABLE "plans" ADD COLUMN "gateway_price_id" TEXT;

-- AlterTable: add tenant_id to users
ALTER TABLE "users" ADD COLUMN "tenant_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_gateway_customer_id_key" ON "tenants"("gateway_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_gateway_subscription_id_key" ON "tenants"("gateway_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_key" ON "users"("tenant_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
