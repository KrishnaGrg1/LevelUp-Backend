/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Clan` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Clan" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "stats" JSONB,
ADD COLUMN     "welcomeMessage" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Clan_slug_key" ON "public"."Clan"("slug");
