/*
  Warnings:

  - Changed the type of `inspectionType` on the `VehicleInspection` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('MOT', 'SAFETY', 'EMISSIONS', 'ANNUAL', 'TFL', 'PRIVATE_HIRE', 'MECHANICAL');

-- AlterTable
ALTER TABLE "VehicleInspection" DROP COLUMN "inspectionType",
ADD COLUMN     "inspectionType" "InspectionType" NOT NULL;
