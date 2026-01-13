/*
  Warnings:

  - A unique constraint covering the columns `[joinCodeHash]` on the table `Community` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Community" ADD COLUMN     "codeUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "joinCodeHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Community_joinCodeHash_key" ON "public"."Community"("joinCodeHash");
