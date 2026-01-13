/*
  Warnings:

  - You are about to drop the column `clanId` on the `CommunityMember` table. All the data in the column will be lost.

*/
-- DropForeignKey (only if exists)
DO $$ BEGIN
    ALTER TABLE "public"."CommunityMember" DROP CONSTRAINT IF EXISTS "CommunityMember_clanId_fkey";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- DropForeignKey (only if exists)
DO $$ BEGIN
    ALTER TABLE "public"."Message" DROP CONSTRAINT IF EXISTS "Message_communityId_fkey";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- AlterTable (drop column only if exists)
DO $$ BEGIN
    ALTER TABLE "public"."CommunityMember" DROP COLUMN IF EXISTS "clanId";
EXCEPTION
    WHEN undefined_column THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "clanId" TEXT,
ALTER COLUMN "communityId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."ClanMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClanMember_userId_communityId_idx" ON "public"."ClanMember"("userId", "communityId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanMember_userId_clanId_key" ON "public"."ClanMember"("userId", "clanId");

-- AddForeignKey
ALTER TABLE "public"."ClanMember" ADD CONSTRAINT "ClanMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClanMember" ADD CONSTRAINT "ClanMember_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "public"."Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClanMember" ADD CONSTRAINT "ClanMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "public"."Clan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
