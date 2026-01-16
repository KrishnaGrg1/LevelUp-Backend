/*
  Warnings:

  - The `features` column on the `SubscriptionPlan` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[joinCodeHash]` on the table `Clan` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Subscription_status_idx";

-- AlterTable
ALTER TABLE "public"."Clan" ADD COLUMN     "joinCodeHash" TEXT;

-- AlterTable
ALTER TABLE "public"."SubscriptionPlan" DROP COLUMN "features",
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Clan_joinCodeHash_key" ON "public"."Clan"("joinCodeHash");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "public"."Subscription"("userId", "status");
