-- CreateTable
CREATE TABLE "PricingSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "transferInstructions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id")
);
