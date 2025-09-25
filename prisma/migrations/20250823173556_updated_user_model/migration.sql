-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;
