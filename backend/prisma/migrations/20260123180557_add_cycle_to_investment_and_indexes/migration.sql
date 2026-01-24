-- DropForeignKey
ALTER TABLE "Investment" DROP CONSTRAINT "Investment_cageId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_cycleId_fkey";

-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "cycleId" TEXT;

-- CreateIndex
CREATE INDEX "Cycle_cageId_idx" ON "Cycle"("cageId");

-- CreateIndex
CREATE INDEX "Cycle_status_idx" ON "Cycle"("status");

-- CreateIndex
CREATE INDEX "Investment_investorId_idx" ON "Investment"("investorId");

-- CreateIndex
CREATE INDEX "Investment_cycleId_idx" ON "Investment"("cycleId");

-- CreateIndex
CREATE INDEX "Investment_cageId_idx" ON "Investment"("cageId");

-- CreateIndex
CREATE INDEX "Payout_investorId_idx" ON "Payout"("investorId");

-- CreateIndex
CREATE INDEX "Payout_cycleId_idx" ON "Payout"("cycleId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_cageId_fkey" FOREIGN KEY ("cageId") REFERENCES "Cage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
