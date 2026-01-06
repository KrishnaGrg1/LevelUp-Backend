-- DropIndex
DROP INDEX "public"."Subscription_userId_status_idx";

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "public"."Subscription"("status");
