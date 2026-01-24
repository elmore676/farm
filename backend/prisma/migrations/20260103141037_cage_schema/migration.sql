/*
  Warnings:

  - The `status` column on the `Cage` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CageStatus" AS ENUM ('active', 'idle', 'maintenance');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('operational', 'maintenance', 'faulty');

-- CreateEnum
CREATE TYPE "InvestorStatus" AS ENUM ('active', 'pending', 'inactive', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('verified', 'pending', 'rejected');

-- AlterEnum
ALTER TYPE "CycleStatus" ADD VALUE 'maintenance';

-- AlterTable
ALTER TABLE "Cage" ADD COLUMN     "code" TEXT,
ADD COLUMN     "currentStock" INTEGER DEFAULT 0,
ADD COLUMN     "depth" DOUBLE PRECISION,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "length" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "locationLabel" TEXT,
ADD COLUMN     "photos" TEXT[],
ADD COLUMN     "species" TEXT,
ADD COLUMN     "width" DOUBLE PRECISION,
DROP COLUMN "status",
ADD COLUMN     "status" "CageStatus" NOT NULL DEFAULT 'idle';

-- AlterTable
ALTER TABLE "Cycle" ADD COLUMN     "fcr" DOUBLE PRECISION,
ADD COLUMN     "harvestedStock" INTEGER,
ADD COLUMN     "initialStock" INTEGER,
ADD COLUMN     "mortality" INTEGER,
ADD COLUMN     "profit" DOUBLE PRECISION,
ADD COLUMN     "revenue" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "shareUnits" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "kycStatus" "KYCStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "status" "InvestorStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "cageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'operational',
    "lastMaintenance" TIMESTAMP(3),
    "nextMaintenance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_cageId_fkey" FOREIGN KEY ("cageId") REFERENCES "Cage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
