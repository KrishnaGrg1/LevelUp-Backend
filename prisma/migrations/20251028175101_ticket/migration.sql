-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('PENDING', 'WORKING_ON', 'TO_BE_DONE_LATER', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."SubjectType" AS ENUM ('ACCOUNT_ISSUE', 'PAYMENT_ISSUE', 'BUG_REPORT', 'FEATURE_REQUEST', 'PERFORMANCE_ISSUE', 'COMMUNITY_MANAGEMENT', 'CLAN_MANAGEMENT', 'QUEST_MANAGEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "public"."Ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" "public"."SubjectType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "public"."TicketPriority" NOT NULL DEFAULT 'LOW',
    "expectedDateOfCompletion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
