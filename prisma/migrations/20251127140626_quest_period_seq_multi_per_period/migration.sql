/*
  Warnings:

  - A unique constraint covering the columns `[userId,type,periodKey,periodSeq]` on the table `Quest` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Quest_userId_type_periodKey_key";

-- AlterTable
ALTER TABLE "public"."Quest" ADD COLUMN     "periodSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Quest_userId_type_periodKey_periodSeq_key" ON "public"."Quest"("userId", "type", "periodKey", "periodSeq");
