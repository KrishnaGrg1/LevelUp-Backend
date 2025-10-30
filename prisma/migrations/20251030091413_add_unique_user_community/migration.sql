/*
  Warnings:

  - A unique constraint covering the columns `[userId,communityId]` on the table `CommunityMember` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_userId_communityId_key" ON "public"."CommunityMember"("userId", "communityId");
