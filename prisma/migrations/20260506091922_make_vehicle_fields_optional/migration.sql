-- AlterTable
ALTER TABLE "VehicleInspection" ALTER COLUMN "inspectionDate" DROP NOT NULL,
ALTER COLUMN "inspectionType" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VehicleInsurance" ALTER COLUMN "provider" DROP NOT NULL,
ALTER COLUMN "policyNumber" DROP NOT NULL,
ALTER COLUMN "startDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VehiclePcoDocument" ALTER COLUMN "issueDate" DROP NOT NULL,
ALTER COLUMN "expiryDate" DROP NOT NULL;
