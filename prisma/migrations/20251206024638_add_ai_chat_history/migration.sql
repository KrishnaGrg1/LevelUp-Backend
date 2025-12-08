-- CreateTable
CREATE TABLE "public"."AIChatHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 1,
    "responseTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIChatHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIChatHistory_userId_createdAt_idx" ON "public"."AIChatHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIChatHistory_sessionId_idx" ON "public"."AIChatHistory"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."AIChatHistory" ADD CONSTRAINT "AIChatHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
