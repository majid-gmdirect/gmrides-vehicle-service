import {
  InspectionType,
  LogBookV5,
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

/** Fields the driver explicitly changed when submitting an inspection change request. */
export type InspectionChangeField =
  | 'inspectionType'
  | 'inspectionDate'
  | 'expiryDate'
  | 'document';

export type StoredInspectionChangePayload = InspectionChangePayload & {
  changedFields: InspectionChangeField[];
};

export type InsuranceChangePayload = {
  provider: string | null;
  policyNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  document: Record<string, unknown> | null;
};

export type InsuranceChangeField =
  | 'provider'
  | 'policyNumber'
  | 'startDate'
  | 'endDate'
  | 'document';

export type StoredInsuranceChangePayload = InsuranceChangePayload & {
  changedFields: InsuranceChangeField[];
};

export type PcoDocumentChangePayload = {
  badgeNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  document: Record<string, unknown> | null;
};

export type PcoDocumentChangeField =
  | 'badgeNumber'
  | 'issueDate'
  | 'expiryDate'
  | 'document';

export type StoredPcoDocumentChangePayload = PcoDocumentChangePayload & {
  changedFields: PcoDocumentChangeField[];
};

export type DocumentOnlyChangePayload = {
  document: Record<string, unknown> | null;
};

export type DocumentOnlyChangeField = 'document';

export type StoredDocumentOnlyChangePayload = DocumentOnlyChangePayload & {
  changedFields: DocumentOnlyChangeField[];
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

export function computeInspectionChangedFields(
  existing: VehicleInspection,
  dto: Partial<{
    inspectionType?: string;
    inspectionDate?: string;
    expiryDate?: string;
    document?: Record<string, unknown>;
  }>,
): InspectionChangeField[] {
  const current = buildInspectionChangePayload(existing, {});
  const changed: InspectionChangeField[] = [];

  if (dto.inspectionType !== undefined) {
    const next = dto.inspectionType ?? null;
    if (next !== current.inspectionType) changed.push('inspectionType');
  }
  if (dto.inspectionDate !== undefined) {
    const next = dto.inspectionDate ?? null;
    if (next !== current.inspectionDate) changed.push('inspectionDate');
  }
  if (dto.expiryDate !== undefined) {
    const next = dto.expiryDate ?? null;
    if (next !== current.expiryDate) changed.push('expiryDate');
  }
  if (dto.document !== undefined) {
    const proposed = buildInspectionChangePayload(existing, {
      document: dto.document,
    });
    if (stableJson(current.document) !== stableJson(proposed.document)) {
      changed.push('document');
    }
  }

  return changed;
}

export function buildStoredInspectionChangePayload(
  existing: VehicleInspection,
  dto: Partial<{
    inspectionType?: string;
    inspectionDate?: string;
    expiryDate?: string;
    document?: Record<string, unknown>;
  }>,
): StoredInspectionChangePayload {
  return {
    ...buildInspectionChangePayload(existing, dto),
    changedFields: computeInspectionChangedFields(existing, dto),
  };
}

export function parseInspectionStoredPayload(raw: unknown): {
  data: InspectionChangePayload;
  changedFields: InspectionChangeField[] | null;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      data: raw as InspectionChangePayload,
      changedFields: null,
    };
  }

  const o = raw as Record<string, unknown>;
  const changedFields = Array.isArray(o.changedFields)
    ? o.changedFields.filter(
        (field): field is InspectionChangeField =>
          field === 'inspectionType' ||
          field === 'inspectionDate' ||
          field === 'expiryDate' ||
          field === 'document',
      )
    : null;

  return {
    data: {
      inspectionType: (o.inspectionType as string | null | undefined) ?? null,
      inspectionDate: (o.inspectionDate as string | null | undefined) ?? null,
      expiryDate: (o.expiryDate as string | null | undefined) ?? null,
      document: (o.document as Record<string, unknown> | null | undefined) ?? null,
    },
    changedFields,
  };
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

/** Applies only driver-submitted fields (partial apply on accept). */
export function inspectionPayloadToPartialPrismaUpdate(
  payload: InspectionChangePayload,
  changedFields: InspectionChangeField[],
): Prisma.VehicleInspectionUpdateInput {
  const full = inspectionPayloadToPrismaUpdate(payload);
  const data: Prisma.VehicleInspectionUpdateInput = {};

  for (const field of changedFields) {
    if (field === 'inspectionType') data.inspectionType = full.inspectionType;
    if (field === 'inspectionDate') data.inspectionDate = full.inspectionDate;
    if (field === 'expiryDate') data.expiryDate = full.expiryDate;
    if (field === 'document') data.document = full.document;
  }

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

export function computeInsuranceChangedFields(
  existing: VehicleInsurance,
  dto: Partial<{
    provider?: string;
    policyNumber?: string;
    startDate?: string;
    endDate?: string;
    document?: Record<string, unknown>;
  }>,
): InsuranceChangeField[] {
  const current = buildInsuranceChangePayload(existing, {});
  const changed: InsuranceChangeField[] = [];

  if (dto.provider !== undefined) {
    const next = dto.provider ?? null;
    if (next !== current.provider) changed.push('provider');
  }
  if (dto.policyNumber !== undefined) {
    const next = dto.policyNumber ?? null;
    if (next !== current.policyNumber) changed.push('policyNumber');
  }
  if (dto.startDate !== undefined) {
    const next = dto.startDate ?? null;
    if (next !== current.startDate) changed.push('startDate');
  }
  if (dto.endDate !== undefined) {
    const next = dto.endDate ?? null;
    if (next !== current.endDate) changed.push('endDate');
  }
  if (dto.document !== undefined) {
    const proposed = buildInsuranceChangePayload(existing, {
      document: dto.document,
    });
    if (stableJson(current.document) !== stableJson(proposed.document)) {
      changed.push('document');
    }
  }

  return changed;
}

export function buildStoredInsuranceChangePayload(
  existing: VehicleInsurance,
  dto: Partial<{
    provider?: string;
    policyNumber?: string;
    startDate?: string;
    endDate?: string;
    document?: Record<string, unknown>;
  }>,
): StoredInsuranceChangePayload {
  return {
    ...buildInsuranceChangePayload(existing, dto),
    changedFields: computeInsuranceChangedFields(existing, dto),
  };
}

const INSURANCE_CHANGE_FIELDS = [
  'provider',
  'policyNumber',
  'startDate',
  'endDate',
  'document',
] as const;

export function parseInsuranceStoredPayload(raw: unknown): {
  data: InsuranceChangePayload;
  changedFields: InsuranceChangeField[] | null;
} {
  const { changedFields, rest } = parseStoredChangedFields(
    raw,
    INSURANCE_CHANGE_FIELDS,
  );
  return {
    data: {
      provider: (rest.provider as string | null | undefined) ?? null,
      policyNumber: (rest.policyNumber as string | null | undefined) ?? null,
      startDate: (rest.startDate as string | null | undefined) ?? null,
      endDate: (rest.endDate as string | null | undefined) ?? null,
      document: (rest.document as Record<string, unknown> | null | undefined) ?? null,
    },
    changedFields,
  };
}

export function insurancePayloadToPartialPrismaUpdate(
  payload: InsuranceChangePayload,
  changedFields: InsuranceChangeField[],
): Prisma.VehicleInsuranceUpdateInput {
  const full = insurancePayloadToPrismaUpdate(payload);
  const data: Prisma.VehicleInsuranceUpdateInput = {};

  for (const field of changedFields) {
    if (field === 'provider') data.provider = full.provider;
    if (field === 'policyNumber') data.policyNumber = full.policyNumber;
    if (field === 'startDate') data.startDate = full.startDate;
    if (field === 'endDate') data.endDate = full.endDate;
    if (field === 'document') data.document = full.document;
  }

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

export function computePcoDocumentChangedFields(
  existing: VehiclePcoDocument,
  dto: Partial<{
    badgeNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    document?: Record<string, unknown>;
  }>,
): PcoDocumentChangeField[] {
  const current = buildPcoDocumentChangePayload(existing, {});
  const changed: PcoDocumentChangeField[] = [];

  if (dto.badgeNumber !== undefined) {
    const next = dto.badgeNumber ?? null;
    if (next !== current.badgeNumber) changed.push('badgeNumber');
  }
  if (dto.issueDate !== undefined) {
    const next = dto.issueDate ?? null;
    if (next !== current.issueDate) changed.push('issueDate');
  }
  if (dto.expiryDate !== undefined) {
    const next = dto.expiryDate ?? null;
    if (next !== current.expiryDate) changed.push('expiryDate');
  }
  if (dto.document !== undefined) {
    const proposed = buildPcoDocumentChangePayload(existing, {
      document: dto.document,
    });
    if (stableJson(current.document) !== stableJson(proposed.document)) {
      changed.push('document');
    }
  }

  return changed;
}

export function buildStoredPcoDocumentChangePayload(
  existing: VehiclePcoDocument,
  dto: Partial<{
    badgeNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    document?: Record<string, unknown>;
  }>,
): StoredPcoDocumentChangePayload {
  return {
    ...buildPcoDocumentChangePayload(existing, dto),
    changedFields: computePcoDocumentChangedFields(existing, dto),
  };
}

const PCO_DOCUMENT_CHANGE_FIELDS = [
  'badgeNumber',
  'issueDate',
  'expiryDate',
  'document',
] as const;

export function parsePcoDocumentStoredPayload(raw: unknown): {
  data: PcoDocumentChangePayload;
  changedFields: PcoDocumentChangeField[] | null;
} {
  const { changedFields, rest } = parseStoredChangedFields(
    raw,
    PCO_DOCUMENT_CHANGE_FIELDS,
  );
  return {
    data: {
      badgeNumber: (rest.badgeNumber as string | null | undefined) ?? null,
      issueDate: (rest.issueDate as string | null | undefined) ?? null,
      expiryDate: (rest.expiryDate as string | null | undefined) ?? null,
      document: (rest.document as Record<string, unknown> | null | undefined) ?? null,
    },
    changedFields,
  };
}

export function pcoDocumentPayloadToPartialPrismaUpdate(
  payload: PcoDocumentChangePayload,
  changedFields: PcoDocumentChangeField[],
): Prisma.VehiclePcoDocumentUpdateInput {
  const full = pcoDocumentPayloadToPrismaUpdate(payload);
  const data: Prisma.VehiclePcoDocumentUpdateInput = {};

  for (const field of changedFields) {
    if (field === 'badgeNumber') data.badgeNumber = full.badgeNumber;
    if (field === 'issueDate') data.issueDate = full.issueDate;
    if (field === 'expiryDate') data.expiryDate = full.expiryDate;
    if (field === 'document') data.document = full.document;
  }

  return data;
}

export function buildDocumentOnlyChangePayload(
  existing: PermissionLetter | VehicleSchedule | LogBookV5,
  dto: Partial<{ document?: Record<string, unknown> }>,
): DocumentOnlyChangePayload {
  return {
    document: mediaFromDto(dto.document, existing.document),
  };
}

export function documentOnlyChangePayloadDiffers(
  payload: DocumentOnlyChangePayload,
  existing: PermissionLetter | VehicleSchedule | LogBookV5,
): boolean {
  const current = buildDocumentOnlyChangePayload(existing, {});
  return stableJson(current.document) !== stableJson(payload.document);
}

export function documentOnlyPayloadToPrismaUpdate(
  payload: DocumentOnlyChangePayload,
):
  | Prisma.PermissionLetterUpdateInput
  | Prisma.VehicleScheduleUpdateInput
  | Prisma.LogBookV5UpdateInput {
  return {
    document: payload.document as Prisma.InputJsonValue,
  };
}

export function computeDocumentOnlyChangedFields(
  existing: PermissionLetter | VehicleSchedule | LogBookV5,
  dto: Partial<{ document?: Record<string, unknown> }>,
): DocumentOnlyChangeField[] {
  if (dto.document === undefined) return [];

  const current = buildDocumentOnlyChangePayload(existing, {});
  const proposed = buildDocumentOnlyChangePayload(existing, {
    document: dto.document,
  });
  if (stableJson(current.document) !== stableJson(proposed.document)) {
    return ['document'];
  }
  return [];
}

export function buildStoredDocumentOnlyChangePayload(
  existing: PermissionLetter | VehicleSchedule | LogBookV5,
  dto: Partial<{ document?: Record<string, unknown> }>,
): StoredDocumentOnlyChangePayload {
  return {
    ...buildDocumentOnlyChangePayload(existing, dto),
    changedFields: computeDocumentOnlyChangedFields(existing, dto),
  };
}

const DOCUMENT_ONLY_CHANGE_FIELDS = ['document'] as const;

export function parseDocumentOnlyStoredPayload(raw: unknown): {
  data: DocumentOnlyChangePayload;
  changedFields: DocumentOnlyChangeField[] | null;
} {
  const { changedFields, rest } = parseStoredChangedFields(
    raw,
    DOCUMENT_ONLY_CHANGE_FIELDS,
  );
  return {
    data: {
      document: (rest.document as Record<string, unknown> | null | undefined) ?? null,
    },
    changedFields,
  };
}

export function documentOnlyPayloadToPartialPrismaUpdate(
  payload: DocumentOnlyChangePayload,
  changedFields: DocumentOnlyChangeField[],
):
  | Prisma.PermissionLetterUpdateInput
  | Prisma.VehicleScheduleUpdateInput
  | Prisma.LogBookV5UpdateInput {
  const full = documentOnlyPayloadToPrismaUpdate(payload);
  const data: DocumentOnlyChangePayload = { document: null };

  for (const field of changedFields) {
    if (field === 'document') data.document = full.document as Record<string, unknown> | null;
  }

  return {
    document: data.document as Prisma.InputJsonValue,
  };
}

export function mapChangePayloadForResponse(
  targetType: VehicleDocumentKind,
  payload: VehicleDocumentChangePayload,
): Record<string, unknown> {
  switch (targetType) {
    case VehicleDocumentKind.INSPECTION: {
      const parsed = parseInspectionStoredPayload(payload);
      const p = parsed.data;
      const response: Record<string, unknown> = {
        inspectionType: p.inspectionType,
        inspectionDate: p.inspectionDate,
        expiryDate: p.expiryDate,
        document: pickPublicMediaRef(p.document),
      };
      if (parsed.changedFields?.length) {
        response.changedFields = parsed.changedFields;
      }
      return response;
    }
    case VehicleDocumentKind.INSURANCE: {
      const parsed = parseInsuranceStoredPayload(payload);
      const p = parsed.data;
      const response: Record<string, unknown> = {
        provider: p.provider,
        policyNumber: p.policyNumber,
        startDate: p.startDate,
        endDate: p.endDate,
        document: pickPublicMediaRef(p.document),
      };
      if (parsed.changedFields?.length) {
        response.changedFields = parsed.changedFields;
      }
      return response;
    }
    case VehicleDocumentKind.PCO_DOCUMENT: {
      const parsed = parsePcoDocumentStoredPayload(payload);
      const p = parsed.data;
      const response: Record<string, unknown> = {
        badgeNumber: p.badgeNumber,
        issueDate: p.issueDate,
        expiryDate: p.expiryDate,
        document: pickPublicMediaRef(p.document),
      };
      if (parsed.changedFields?.length) {
        response.changedFields = parsed.changedFields;
      }
      return response;
    }
    case VehicleDocumentKind.PERMISSION_LETTER:
    case VehicleDocumentKind.SCHEDULE:
    case VehicleDocumentKind.LOG_BOOK_V5: {
      const parsed = parseDocumentOnlyStoredPayload(payload);
      const response: Record<string, unknown> = {
        document: pickPublicMediaRef(parsed.data.document),
      };
      if (parsed.changedFields?.length) {
        response.changedFields = parsed.changedFields;
      }
      return response;
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
    case VehicleDocumentKind.LOG_BOOK_V5:
      return 'log book V5';
    default:
      return 'vehicle document';
  }
}
