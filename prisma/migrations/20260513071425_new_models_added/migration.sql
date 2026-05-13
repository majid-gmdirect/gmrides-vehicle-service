-- CreateTable
CREATE TABLE "PermissionLetter" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "document" JSONB,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSchedule" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "document" JSONB,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleSchedule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PermissionLetter" ADD CONSTRAINT "PermissionLetter_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSchedule" ADD CONSTRAINT "VehicleSchedule_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
