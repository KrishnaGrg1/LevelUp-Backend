-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "banUntil" TIMESTAMP(3),
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false;
