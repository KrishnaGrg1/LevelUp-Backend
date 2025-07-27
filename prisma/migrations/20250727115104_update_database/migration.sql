/*
  Warnings:

  - You are about to drop the column `goalId` on the `Quest` table. All the data in the column will be lost.
  - You are about to drop the column `recurrence` on the `Quest` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Quest` table. All the data in the column will be lost.
  - You are about to drop the column `streak` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Badge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CommunityLeaderboard` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CompletionQuest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GlobalUserLeaderboard` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Goal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserBadge` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Community` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Quest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('Beginner', 'Intermediate', 'Advanced');

-- CreateEnum
CREATE TYPE "QuestSource" AS ENUM ('AI', 'TEMPLATE', 'MANUAL');

-- DropForeignKey
ALTER TABLE "CommunityLeaderboard" DROP CONSTRAINT "CommunityLeaderboard_communityId_fkey";

-- DropForeignKey
ALTER TABLE "CompletionQuest" DROP CONSTRAINT "CompletionQuest_questId_fkey";

-- DropForeignKey
ALTER TABLE "CompletionQuest" DROP CONSTRAINT "CompletionQuest_userId_fkey";

-- DropForeignKey
ALTER TABLE "GlobalUserLeaderboard" DROP CONSTRAINT "GlobalUserLeaderboard_userId_fkey";

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_userId_fkey";

-- DropForeignKey
ALTER TABLE "Quest" DROP CONSTRAINT "Quest_goalId_fkey";

-- DropForeignKey
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_badgeId_fkey";

-- DropForeignKey
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_userId_fkey";

-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CommunityMember" ADD COLUMN     "clanId" INTEGER,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "MemberStatus" NOT NULL DEFAULT 'Beginner';

-- AlterTable
ALTER TABLE "Quest" DROP COLUMN "goalId",
DROP COLUMN "recurrence",
DROP COLUMN "text",
ADD COLUMN     "communityMemberId" INTEGER,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "source" "QuestSource" NOT NULL DEFAULT 'AI';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "streak",
ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Badge";

-- DropTable
DROP TABLE "CommunityLeaderboard";

-- DropTable
DROP TABLE "CompletionQuest";

-- DropTable
DROP TABLE "GlobalUserLeaderboard";

-- DropTable
DROP TABLE "Goal";

-- DropTable
DROP TABLE "QuestTemplate";

-- DropTable
DROP TABLE "UserBadge";

-- DropEnum
DROP TYPE "GoalCategory";

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "ownerId" INTEGER NOT NULL,
    "communityId" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_name_key" ON "Clan"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clan" ADD CONSTRAINT "Clan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clan" ADD CONSTRAINT "Clan_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_communityMemberId_fkey" FOREIGN KEY ("communityMemberId") REFERENCES "CommunityMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
