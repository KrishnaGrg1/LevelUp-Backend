-- CreateEnum
CREATE TYPE "public"."Experience" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "hasOnboarded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."UserOnboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "heardAboutUs" TEXT,
    "goal" TEXT,
    "experience" "public"."Experience",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_CategoryToUserOnboarding" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToUserOnboarding_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserOnboarding_userId_key" ON "public"."UserOnboarding"("userId");

-- CreateIndex
CREATE INDEX "_CategoryToUserOnboarding_B_index" ON "public"."_CategoryToUserOnboarding"("B");

-- AddForeignKey
ALTER TABLE "public"."UserOnboarding" ADD CONSTRAINT "UserOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToUserOnboarding" ADD CONSTRAINT "_CategoryToUserOnboarding_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToUserOnboarding" ADD CONSTRAINT "_CategoryToUserOnboarding_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."UserOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
