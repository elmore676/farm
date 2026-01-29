-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('investment', 'payout', 'refund', 'adjustment');

-- AddColumn totalInvestment, totalReturns, roi to Investor table
ALTER TABLE "Investor" ADD COLUMN "totalInvestment" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Investor" ADD COLUMN "totalReturns" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Investor" ADD COLUMN "roi" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable Transaction
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "investorId" TEXT,
    "payoutId" TEXT,
    "cycleId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
