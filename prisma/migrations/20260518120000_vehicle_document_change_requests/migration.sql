-- CreateEnum
CREATE TYPE "VehicleDocumentKind" AS ENUM ('INSPECTION', 'INSURANCE', 'PCO_DOCUMENT', 'PERMISSION_LETTER', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "VehicleDocumentChangeRequestStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "VehicleDocumentChangeRequest" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "targetType" "VehicleDocumentKind" NOT NULL,
    "targetDocumentId" TEXT NOT NULL,
    "status" "VehicleDocumentChangeRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "payload" JSONB NOT NULL,
    "driver_note" TEXT,
    "rejected_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleDocumentChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleDocumentChangeRequest_driverId_status_idx" ON "VehicleDocumentChangeRequest"("driverId", "status");

-- CreateIndex
CREATE INDEX "VehicleDocumentChangeRequest_vehicleId_status_idx" ON "VehicleDocumentChangeRequest"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "VehicleDocumentChangeRequest_targetType_targetDocumentId_s_idx" ON "VehicleDocumentChangeRequest"("targetType", "targetDocumentId", "status");

-- Partial unique: at most one pending change request per target document
CREATE UNIQUE INDEX "VehicleDocumentChangeRequest_one_pending_per_target"
ON "VehicleDocumentChangeRequest" ("targetType", "targetDocumentId")
WHERE "status" = 'PENDING_REVIEW';

-- AddForeignKey
ALTER TABLE "VehicleDocumentChangeRequest" ADD CONSTRAINT "VehicleDocumentChangeRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
