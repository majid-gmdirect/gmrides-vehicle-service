import { Prisma, Vehicle, VehicleType } from '@prisma/client';
import { pickPublicMediaRef } from './json-media.util';

export type VehicleChangePayload = {
  make: string;
  model: string;
  year: number;
  color: string | null;
  plateNumber: string;
  vehicleType: VehicleType;
  isActive: boolean;
  permission_letter: Record<string, unknown> | null;
  vehicle_schedule: Record<string, unknown> | null;
};

export type VehicleChangeField = keyof VehicleChangePayload;

export type StoredVehicleChangePayload = VehicleChangePayload & {
  changedFields: VehicleChangeField[];
};

export type VehicleChangeInput = {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  plateNumber?: string;
  vehicleType?: VehicleType;
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
    vehicleType:
      dto.vehicleType !== undefined ? dto.vehicleType : existing.vehicleType,
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

const VEHICLE_CHANGE_FIELDS = [
  'make',
  'model',
  'year',
  'color',
  'plateNumber',
  'vehicleType',
  'isActive',
  'permission_letter',
  'vehicle_schedule',
] as const satisfies readonly VehicleChangeField[];

function parseStoredChangedFields<T extends string>(
  raw: unknown,
  allowed: readonly T[],
): { changedFields: T[] | null; rest: Record<string, unknown> } {
  if (!raw || typeof raw !== 'object') {
    return { changedFields: null, rest: {} };
  }
  const o = raw as Record<string, unknown>;
  const changedFields = Array.isArray(o.changedFields)
    ? o.changedFields.filter((field): field is T => allowed.includes(field as T))
    : null;
  return { changedFields, rest: o };
}

export function computeVehicleChangedFields(
  existing: Vehicle,
  dto: VehicleChangeInput,
): VehicleChangeField[] {
  const current = buildVehicleChangePayload(existing, {});
  const changed: VehicleChangeField[] = [];

  for (const field of VEHICLE_CHANGE_FIELDS) {
    if ((dto as Record<string, unknown>)[field] === undefined) continue;
    const proposed = buildVehicleChangePayload(existing, dto);
    if (field === 'permission_letter' || field === 'vehicle_schedule') {
      if (stableJson(current[field]) !== stableJson(proposed[field])) {
        changed.push(field);
      }
    } else if (current[field] !== proposed[field]) {
      changed.push(field);
    }
  }

  return changed;
}

export function buildStoredVehicleChangePayload(
  existing: Vehicle,
  dto: VehicleChangeInput,
): StoredVehicleChangePayload {
  return {
    ...buildVehicleChangePayload(existing, dto),
    changedFields: computeVehicleChangedFields(existing, dto),
  };
}

export function parseVehicleStoredPayload(raw: unknown): {
  data: VehicleChangePayload;
  changedFields: VehicleChangeField[] | null;
} {
  const { changedFields, rest } = parseStoredChangedFields(
    raw,
    VEHICLE_CHANGE_FIELDS,
  );
  return {
    data: {
      make: (rest.make as string | undefined) ?? '',
      model: (rest.model as string | undefined) ?? '',
      year: (rest.year as number | undefined) ?? 0,
      color: (rest.color as string | null | undefined) ?? null,
      plateNumber: (rest.plateNumber as string | undefined) ?? '',
      vehicleType:
        (rest.vehicleType as VehicleType | undefined) ?? VehicleType.STANDARD,
      isActive: (rest.isActive as boolean | undefined) ?? true,
      permission_letter:
        (rest.permission_letter as Record<string, unknown> | null | undefined) ??
        null,
      vehicle_schedule:
        (rest.vehicle_schedule as Record<string, unknown> | null | undefined) ??
        null,
    },
    changedFields,
  };
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
    current.vehicleType !== payload.vehicleType ||
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
    vehicleType: payload.vehicleType,
    isActive: payload.isActive,
    permission_letter: payload.permission_letter as Prisma.InputJsonValue,
    vehicle_schedule: payload.vehicle_schedule as Prisma.InputJsonValue,
  };
}

export function vehiclePayloadToPartialPrismaUpdate(
  payload: VehicleChangePayload,
  changedFields: VehicleChangeField[],
): Prisma.VehicleUpdateInput {
  const full = vehiclePayloadToPrismaUpdate(payload);
  const data: Prisma.VehicleUpdateInput = {};

  for (const field of changedFields) {
    (data as Record<string, unknown>)[field] = (full as Record<string, unknown>)[field];
  }

  return data;
}

export function mapVehicleChangePayloadForResponse(
  payload: VehicleChangePayload | StoredVehicleChangePayload,
): Record<string, unknown> {
  const response: Record<string, unknown> = {
    make: payload.make,
    model: payload.model,
    year: payload.year,
    color: payload.color,
    plateNumber: payload.plateNumber,
    vehicleType: payload.vehicleType,
    isActive: payload.isActive,
    permission_letter: pickPublicMediaRef(payload.permission_letter),
    vehicle_schedule: pickPublicMediaRef(payload.vehicle_schedule),
  };
  if ('changedFields' in payload && payload.changedFields?.length) {
    response.changedFields = payload.changedFields;
  }
  return response;
}
