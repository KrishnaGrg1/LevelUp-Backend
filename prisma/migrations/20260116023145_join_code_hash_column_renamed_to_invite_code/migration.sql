/*
  Warnings:

  - You are about to drop the column `joinCodeHash` on the `Community` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[inviteCode]` on the table `Community` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Community_joinCodeHash_key";

-- AlterTable
ALTER TABLE "public"."Community" DROP COLUMN "joinCodeHash",
ADD COLUMN     "inviteCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Community_inviteCode_key" ON "public"."Community"("inviteCode");
