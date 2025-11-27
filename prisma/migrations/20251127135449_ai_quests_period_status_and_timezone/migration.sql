/*
  Warnings:

  - A unique constraint covering the columns `[userId,type,periodKey]` on the table `Quest` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."PeriodStatus" AS ENUM ('TODAY', 'YESTERDAY', 'DAY_BEFORE_YESTERDAY', 'THIS_WEEK', 'LAST_WEEK', 'TWO_WEEKS_AGO', 'NONE');

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_communityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_senderId_fkey";

-- AlterTable
ALTER TABLE "public"."Quest" ADD COLUMN     "periodKey" TEXT,
ADD COLUMN     "periodStatus" "public"."PeriodStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "tokens" INTEGER NOT NULL DEFAULT 50;

-- CreateIndex
CREATE INDEX "Quest_userId_type_date_idx" ON "public"."Quest"("userId", "type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_userId_type_periodKey_key" ON "public"."Quest"("userId", "type", "periodKey");

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
