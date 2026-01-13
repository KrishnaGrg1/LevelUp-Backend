/*
  Warnings:

  - You are about to drop the column `categoryId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ClanMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ClanMember" DROP CONSTRAINT "ClanMember_clanId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ClanMember" DROP CONSTRAINT "ClanMember_communityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ClanMember" DROP CONSTRAINT "ClanMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_clanId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_categoryId_fkey";

-- AlterTable
ALTER TABLE "public"."Quest" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "viewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "categoryId";

-- DropTable
DROP TABLE "public"."ClanMember";

-- CreateTable
CREATE TABLE "public"."clanMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clanMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_CategoryToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "clanMember_userId_communityId_idx" ON "public"."clanMember"("userId", "communityId");

-- CreateIndex
CREATE UNIQUE INDEX "clanMember_userId_clanId_key" ON "public"."clanMember"("userId", "clanId");

-- CreateIndex
CREATE INDEX "_CategoryToUser_B_index" ON "public"."_CategoryToUser"("B");

-- AddForeignKey
ALTER TABLE "public"."clanMember" ADD CONSTRAINT "clanMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clanMember" ADD CONSTRAINT "clanMember_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "public"."Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clanMember" ADD CONSTRAINT "clanMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "public"."Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToUser" ADD CONSTRAINT "_CategoryToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToUser" ADD CONSTRAINT "_CategoryToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
