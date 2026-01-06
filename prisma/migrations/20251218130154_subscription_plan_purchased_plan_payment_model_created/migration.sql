-- CreateEnum
CREATE TYPE "public"."PurchaseStatus" AS ENUM ('pending', 'completed', 'refunded');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('khalti');

-- CreateEnum
CREATE TYPE "public"."PaymentGateway" AS ENUM ('khalti', 'esewa', 'connectIps');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('success', 'pending', 'failed');

-- CreateTable
CREATE TABLE "public"."SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "durationMonth" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchasedPlan" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "status" "public"."PurchaseStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasedPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT,
    "pidx" TEXT,
    "productId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dataFromVerificationReq" JSONB,
    "apiQueryFromUser" JSONB,
    "paymentGateway" "public"."PaymentGateway" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "public"."Payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_pidx_key" ON "public"."Payment"("pidx");

-- AddForeignKey
ALTER TABLE "public"."PurchasedPlan" ADD CONSTRAINT "PurchasedPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PurchasedPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
