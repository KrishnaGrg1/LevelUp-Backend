-- AlterTable
ALTER TABLE "public"."Community" ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."clanMember" ADD COLUMN     "totalXP" INTEGER NOT NULL DEFAULT 0;
