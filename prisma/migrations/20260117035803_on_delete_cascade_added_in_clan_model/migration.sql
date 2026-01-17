-- DropForeignKey
ALTER TABLE "public"."Clan" DROP CONSTRAINT "Clan_communityId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Clan" ADD CONSTRAINT "Clan_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
