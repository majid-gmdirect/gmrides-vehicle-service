import {
  InspectionType,
  PermissionLetter,
  Prisma,
  VehicleDocumentKind,
  VehicleInspection,
  VehicleInsurance,
  VehiclePcoDocument,
  VehicleSchedule,
} from '@prisma/client';
import { pickPublicMediaRef } from './json-media.util';
import {
  toPayloadDateString,
  toPrismaDateTime,
} from './vehicle-document-datetime.util';

export type InspectionChangePayload = {
  inspectionType: string | null;
  inspectionDate: string | null;
  expiryDate: string | null;
  document: Record<string, unknown> | null;
};

export type InsuranceChangePayload = {
  provider: string | null;
  policyNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  document: Record<string, unknown> | null;
};

export type PcoDocumentChangePayload = {
  badgeNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  document: Record<string, unknown> | null;
};

export type DocumentOnlyChangePayload = {
  document: Record<string, unknown> | null;
};

export type VehicleDocumentChangePayload =
  | InspectionChangePayload
  | InsuranceChangePayload
  | PcoDocumentChangePayload
  | DocumentOnlyChangePayload;

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

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function buildInspectionChangePayload(
  existing: VehicleInspection,
  dto: Partial<{
    inspectionType?: string;
    inspectionDate?: string;
    expiryDate?: string;
    document?: Record<string, unknown>;
  }>,
): InspectionChangePayload {
  return {
    inspectionType:
      dto.inspectionType !== undefined
        ? dto.inspectionType ?? null
        : existing.inspectionType,
    inspectionDate:
      dto.inspectionDate !== undefined
        ? dto.inspectionDate ?? null
        : toPayloadDateString(existing.inspectionDate),
    expiryDate:
      dto.expiryDate !== undefined
        ? dto.expiryDate ?? null
        : toPayloadDateString(existing.expiryDate),
    document: mediaFromDto(dto.document, existing.document),
  };
}

export function inspectionChangePayloadDiffers(
  payload: InspectionChangePayload,
  existing: VehicleInspection,
): boolean {
  const current = buildInspectionChangePayload(existing, {});
  return (
    current.inspectionType !== payload.inspectionType ||
    current.inspectionDate !== payload.inspectionDate ||
    current.expiryDate !== payload.expiryDate ||
    stableJson(current.document) !== stableJson(payload.document)
  );
}

export function inspectionPayloadToPrismaUpdate(
  payload: InspectionChangePayload,
): Prisma.VehicleInspectionUpdateInput {
  const data: Prisma.VehicleInspectionUpdateInput = {
    document: payload.document as Prisma.InputJsonValue,
  };
  data.inspectionType = payload.inspectionType as InspectionType | null;
  data.inspectionDate =
    payload.inspectionDate != null
      ? toPrismaDateTime(payload.inspectionDate)
      : null;
  data.expiryDate =
    payload.expiryDate != null ? toPrismaDateTime(payload.expiryDate) : null;
  return data;
}

export function buildInsuranceChangePayload(
  existing: VehicleInsurance,
  dto: Partial<{
    provider?: string;
    policyNumber?: string;
    startDate?: string;
    endDate?: string;
    document?: Record<string, unknown>;
  }>,
): InsuranceChangePayload {
  return {
    provider:
      dto.provider !== undefined ? dto.provider ?? null : existing.provider,
    policyNumber:
      dto.policyNumber !== undefined
        ? dto.policyNumber ?? null
        : existing.policyNumber,
    startDate:
      dto.startDate !== undefined
        ? dto.startDate ?? null
        : toPayloadDateString(existing.startDate),
    endDate:
      dto.endDate !== undefined
        ? dto.endDate ?? null
        : toPayloadDateString(existing.endDate),
    document: mediaFromDto(dto.document, existing.document),
  };
}

export function insuranceChangePayloadDiffers(
  payload: InsuranceChangePayload,
  existing: VehicleInsurance,
): boolean {
  const current = buildInsuranceChangePayload(existing, {});
  return (
    current.provider !== payload.provider ||
    current.policyNumber !== payload.policyNumber ||
    current.startDate !== payload.startDate ||
    current.endDate !== payload.endDate ||
    stableJson(current.document) !== stableJson(payload.document)
  );
}

export function insurancePayloadToPrismaUpdate(
  payload: InsuranceChangePayload,
): Prisma.VehicleInsuranceUpdateInput {
  const data: Prisma.VehicleInsuranceUpdateInput = {
    provider: payload.provider,
    policyNumber: payload.policyNumber,
    document: payload.document as Prisma.InputJsonValue,
  };
  data.startDate =
    payload.startDate != null ? toPrismaDateTime(payload.startDate) : null;
  data.endDate =
    payload.endDate != null ? toPrismaDateTime(payload.endDate) : null;
  return data;
}

export function buildPcoDocumentChangePayload(
  existing: VehiclePcoDocument,
  dto: Partial<{
    badgeNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    document?: Record<string, unknown>;
  }>,
): PcoDocumentChangePayload {
  return {
    badgeNumber:
      dto.badgeNumber !== undefined
        ? dto.badgeNumber ?? null
        : existing.badgeNumber,
    issueDate:
      dto.issueDate !== undefined
        ? dto.issueDate ?? null
        : toPayloadDateString(existing.issueDate),
    expiryDate:
      dto.expiryDate !== undefined
        ? dto.expiryDate ?? null
        : toPayloadDateString(existing.expiryDate),
    document: mediaFromDto(dto.document, existing.document),
  };
}

export function pcoDocumentChangePayloadDiffers(
  payload: PcoDocumentChangePayload,
  existing: VehiclePcoDocument,
): boolean {
  const current = buildPcoDocumentChangePayload(existing, {});
  return (
    current.badgeNumber !== payload.badgeNumber ||
    current.issueDate !== payload.issueDate ||
    current.expiryDate !== payload.expiryDate ||
    stableJson(current.document) !== stableJson(payload.document)
  );
}

export function pcoDocumentPayloadToPrismaUpdate(
  payload: PcoDocumentChangePayload,
): Prisma.VehiclePcoDocumentUpdateInput {
  const data: Prisma.VehiclePcoDocumentUpdateInput = {
    badgeNumber: payload.badgeNumber,
    document: payload.document as Prisma.InputJsonValue,
  };
  data.issueDate =
    payload.issueDate != null ? toPrismaDateTime(payload.issueDate) : null;
  data.expiryDate =
    payload.expiryDate != null ? toPrismaDateTime(payload.expiryDate) : null;
  return data;
}

export function buildDocumentOnlyChangePayload(
  existing: PermissionLetter | VehicleSchedule,
  dto: Partial<{ document?: Record<string, unknown> }>,
): DocumentOnlyChangePayload {
  return {
    document: mediaFromDto(dto.document, existing.document),
  };
}

export function documentOnlyChangePayloadDiffers(
  payload: DocumentOnlyChangePayload,
  existing: PermissionLetter | VehicleSchedule,
): boolean {
  const current = buildDocumentOnlyChangePayload(existing, {});
  return stableJson(current.document) !== stableJson(payload.document);
}

export function documentOnlyPayloadToPrismaUpdate(
  payload: DocumentOnlyChangePayload,
): Prisma.PermissionLetterUpdateInput | Prisma.VehicleScheduleUpdateInput {
  return {
    document: payload.document as Prisma.InputJsonValue,
  };
}

export function mapChangePayloadForResponse(
  targetType: VehicleDocumentKind,
  payload: VehicleDocumentChangePayload,
): Record<string, unknown> {
  switch (targetType) {
    case VehicleDocumentKind.INSPECTION: {
      const p = payload as InspectionChangePayload;
      return {
        inspectionType: p.inspectionType,
        inspectionDate: p.inspectionDate,
        expiryDate: p.expiryDate,
        document: pickPublicMediaRef(p.document),
      };
    }
    case VehicleDocumentKind.INSURANCE: {
      const p = payload as InsuranceChangePayload;
      return {
        provider: p.provider,
        policyNumber: p.policyNumber,
        startDate: p.startDate,
        endDate: p.endDate,
        document: pickPublicMediaRef(p.document),
      };
    }
    case VehicleDocumentKind.PCO_DOCUMENT: {
      const p = payload as PcoDocumentChangePayload;
      return {
        badgeNumber: p.badgeNumber,
        issueDate: p.issueDate,
        expiryDate: p.expiryDate,
        document: pickPublicMediaRef(p.document),
      };
    }
    case VehicleDocumentKind.PERMISSION_LETTER:
    case VehicleDocumentKind.SCHEDULE: {
      const p = payload as DocumentOnlyChangePayload;
      return { document: pickPublicMediaRef(p.document) };
    }
    default:
      return payload as unknown as Record<string, unknown>;
  }
}

export function vehicleDocumentKindLabel(
  targetType: VehicleDocumentKind,
): string {
  switch (targetType) {
    case VehicleDocumentKind.INSPECTION:
      return 'vehicle inspection';
    case VehicleDocumentKind.INSURANCE:
      return 'vehicle insurance';
    case VehicleDocumentKind.PCO_DOCUMENT:
      return 'vehicle PCO document';
    case VehicleDocumentKind.PERMISSION_LETTER:
      return 'permission letter';
    case VehicleDocumentKind.SCHEDULE:
      return 'vehicle schedule';
    default:
      return 'vehicle document';
  }
}
