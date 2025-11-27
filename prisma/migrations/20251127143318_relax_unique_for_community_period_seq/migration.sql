-- DropIndex
DROP INDEX "public"."Quest_userId_type_date_idx";

-- DropIndex
DROP INDEX "public"."Quest_userId_type_periodKey_periodSeq_key";

-- AlterTable
ALTER TABLE "public"."Quest" ADD COLUMN     "communityId" TEXT;

-- CreateIndex
CREATE INDEX "Quest_userId_communityId_type_date_idx" ON "public"."Quest"("userId", "communityId", "type", "date");

-- AddForeignKey
ALTER TABLE "public"."Quest" ADD CONSTRAINT "Quest_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
