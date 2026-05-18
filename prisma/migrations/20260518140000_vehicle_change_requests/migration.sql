-- CreateTable
CREATE TABLE "VehicleChangeRequest" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "VehicleDocumentChangeRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "payload" JSONB NOT NULL,
    "driver_note" TEXT,
    "rejected_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleChangeRequest_driverId_status_idx" ON "VehicleChangeRequest"("driverId", "status");

-- CreateIndex
CREATE INDEX "VehicleChangeRequest_vehicleId_status_idx" ON "VehicleChangeRequest"("vehicleId", "status");

-- Partial unique: at most one pending change request per vehicle
CREATE UNIQUE INDEX "VehicleChangeRequest_one_pending_per_vehicle"
ON "VehicleChangeRequest" ("vehicleId")
WHERE "status" = 'PENDING_REVIEW';

-- AddForeignKey
ALTER TABLE "VehicleChangeRequest" ADD CONSTRAINT "VehicleChangeRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
