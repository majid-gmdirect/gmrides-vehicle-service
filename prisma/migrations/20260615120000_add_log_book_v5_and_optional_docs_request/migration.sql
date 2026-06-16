-- AlterEnum
ALTER TYPE "VehicleDocumentKind" ADD VALUE 'LOG_BOOK_V5';

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "requiestOptionalDocuments" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LogBookV5" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogBookV5_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogBookV5_vehicleId_status_idx" ON "LogBookV5"("vehicleId", "status");

-- AddForeignKey
ALTER TABLE "LogBookV5" ADD CONSTRAINT "LogBookV5_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
