-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'PENDING');

-- AlterTable
ALTER TABLE "VehicleInspection" ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "VehicleInsurance" ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "VehiclePcoDocument" ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING';
