-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('STANDARD', 'EXECUTIVE', 'LUXURY', 'SEVEN_SEATER');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "vehicleType" "VehicleType" NOT NULL DEFAULT 'STANDARD';
