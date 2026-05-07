-- CreateEnum (idempotent: some environments may already have it)
DO $$
BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'PENDING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure enum values exist (in case the type pre-existed but was missing labels)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DocumentStatus' AND e.enumlabel = 'ACCEPTED'
  ) THEN
    ALTER TYPE "DocumentStatus" ADD VALUE 'ACCEPTED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DocumentStatus' AND e.enumlabel = 'REJECTED'
  ) THEN
    ALTER TYPE "DocumentStatus" ADD VALUE 'REJECTED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DocumentStatus' AND e.enumlabel = 'PENDING'
  ) THEN
    ALTER TYPE "DocumentStatus" ADD VALUE 'PENDING';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "VehicleInspection"
ADD COLUMN IF NOT EXISTS "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT;

-- AlterTable
ALTER TABLE "VehicleInsurance"
ADD COLUMN IF NOT EXISTS "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT;

-- AlterTable
ALTER TABLE "VehiclePcoDocument"
ADD COLUMN IF NOT EXISTS "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT;

