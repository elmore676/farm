-- CreateTable
CREATE TABLE "WeightSample" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "averageWeight" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "minWeight" DOUBLE PRECISION,
    "maxWeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeightSample_cycleId_idx" ON "WeightSample"("cycleId");

-- CreateIndex
CREATE INDEX "WeightSample_date_idx" ON "WeightSample"("date");

-- AddForeignKey
ALTER TABLE "WeightSample" ADD CONSTRAINT "WeightSample_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
