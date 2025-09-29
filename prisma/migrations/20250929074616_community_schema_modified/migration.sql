-- AlterTable
ALTER TABLE "public"."Community" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memberLimit" INTEGER NOT NULL DEFAULT 100;
