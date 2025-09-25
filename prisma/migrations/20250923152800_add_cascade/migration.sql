-- DropForeignKey
ALTER TABLE "public"."Clan" DROP CONSTRAINT "Clan_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Community" DROP CONSTRAINT "Community_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CommunityMember" DROP CONSTRAINT "CommunityMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Otp" DROP CONSTRAINT "Otp_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Quest" DROP CONSTRAINT "Quest_userId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Community" ADD CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Clan" ADD CONSTRAINT "Clan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommunityMember" ADD CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quest" ADD CONSTRAINT "Quest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
