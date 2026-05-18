import { Prisma, Vehicle } from '@prisma/client';
import { pickPublicMediaRef } from './json-media.util';

export type VehicleChangePayload = {
  make: string;
  model: string;
  year: number;
  color: string | null;
  plateNumber: string;
  isActive: boolean;
  permission_letter: Record<string, unknown> | null;
  vehicle_schedule: Record<string, unknown> | null;
};

export type VehicleChangeInput = {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  plateNumber?: string;
  isActive?: boolean;
  permission_letter?: Record<string, unknown>;
  vehicle_schedule?: Record<string, unknown>;
};

function mediaFromJson(value: unknown): Record<string, unknown> | null {
  const ref = pickPublicMediaRef(value);
  if (!ref) return null;
  const out: Record<string, unknown> = { url: ref.url };
  if (ref.id) out.id = ref.id;
  return out;
}

function mediaFromDto(
  dtoValue: Record<string, unknown> | undefined,
  existingValue: unknown,
): Record<string, unknown> | null {
  if (dtoValue !== undefined) {
    if (dtoValue == null) return null;
    return mediaFromJson(dtoValue);
  }
  return mediaFromJson(existingValue);
}

function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

export function buildVehicleChangePayload(
  existing: Vehicle,
  dto: VehicleChangeInput,
): VehicleChangePayload {
  return {
    make: dto.make !== undefined ? dto.make.trim() : existing.make,
    model: dto.model !== undefined ? dto.model.trim() : existing.model,
    year: dto.year !== undefined ? dto.year : existing.year,
    color:
      dto.color !== undefined ? dto.color?.trim() || null : existing.color,
    plateNumber:
      dto.plateNumber !== undefined
        ? normalizePlate(dto.plateNumber)
        : existing.plateNumber,
    isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
    permission_letter: mediaFromDto(
      dto.permission_letter,
      existing.permission_letter,
    ),
    vehicle_schedule: mediaFromDto(dto.vehicle_schedule, existing.vehicle_schedule),
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function vehicleChangePayloadDiffers(
  payload: VehicleChangePayload,
  existing: Vehicle,
): boolean {
  const current = buildVehicleChangePayload(existing, {});
  return (
    current.make !== payload.make ||
    current.model !== payload.model ||
    current.year !== payload.year ||
    current.color !== payload.color ||
    current.plateNumber !== payload.plateNumber ||
    current.isActive !== payload.isActive ||
    stableJson(current.permission_letter) !==
      stableJson(payload.permission_letter) ||
    stableJson(current.vehicle_schedule) !== stableJson(payload.vehicle_schedule)
  );
}

export function vehiclePayloadToPrismaUpdate(
  payload: VehicleChangePayload,
): Prisma.VehicleUpdateInput {
  return {
    make: payload.make,
    model: payload.model,
    year: payload.year,
    color: payload.color,
    plateNumber: payload.plateNumber,
    isActive: payload.isActive,
    permission_letter: payload.permission_letter as Prisma.InputJsonValue,
    vehicle_schedule: payload.vehicle_schedule as Prisma.InputJsonValue,
  };
}

export function mapVehicleChangePayloadForResponse(
  payload: VehicleChangePayload,
): Record<string, unknown> {
  return {
    make: payload.make,
    model: payload.model,
    year: payload.year,
    color: payload.color,
    plateNumber: payload.plateNumber,
    isActive: payload.isActive,
    permission_letter: pickPublicMediaRef(payload.permission_letter),
    vehicle_schedule: pickPublicMediaRef(payload.vehicle_schedule),
  };
}
