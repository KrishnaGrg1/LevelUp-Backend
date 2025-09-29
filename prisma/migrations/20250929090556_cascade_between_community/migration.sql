-- DropForeignKey
ALTER TABLE "public"."CommunityMember" DROP CONSTRAINT "CommunityMember_communityId_fkey";

-- AddForeignKey
ALTER TABLE "public"."CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
