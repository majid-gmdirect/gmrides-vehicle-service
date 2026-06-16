import {
  NormalizedReviewStatus,
  normalizeToReviewStatus,
  pickAggregateReviewStatus,
} from './document-review-status.util';

export type VehicleDocumentGroupKey =
  | 'logBookV5'
  | 'inspections'
  | 'insurances'
  | 'pcoDocs'
  | 'permissionLetters'
  | 'vehicleSchedules';

export type VehicleDocumentGroupInput = {
  key: VehicleDocumentGroupKey;
  label: string;
  documents: Array<{ status: string }>;
};

const ALWAYS_REQUIRED_GROUPS: VehicleDocumentGroupKey[] = [
  'logBookV5',
  'inspections',
  'insurances',
  'pcoDocs',
];

const CONDITIONALLY_REQUIRED_GROUPS: VehicleDocumentGroupKey[] = [
  'permissionLetters',
  'vehicleSchedules',
];

export const VEHICLE_DOCUMENT_GROUP_LABELS: Record<VehicleDocumentGroupKey, string> =
  {
    logBookV5: 'Log book V5',
    inspections: 'Vehicle inspection',
    insurances: 'Vehicle insurance',
    pcoDocs: 'Vehicle PCO document',
    permissionLetters: 'Permission letter',
    vehicleSchedules: 'Vehicle schedule',
  };

export function isVehicleDocumentGroupRequired(
  group: VehicleDocumentGroupKey,
  requiestOptionalDocuments: boolean,
): boolean {
  if (ALWAYS_REQUIRED_GROUPS.includes(group)) return true;
  if (CONDITIONALLY_REQUIRED_GROUPS.includes(group)) {
    return requiestOptionalDocuments;
  }
  return false;
}

export type VehicleDocumentGroupAssessment = {
  key: VehicleDocumentGroupKey;
  label: string;
  required: boolean;
  satisfied: boolean;
  reviewStatus: NormalizedReviewStatus | null;
  missing: boolean;
};

export type VehicleDocumentRequirementsAssessment = {
  optionalDocumentsRequested: boolean;
  readyForApproval: boolean;
  missingRequired: string[];
  groups: VehicleDocumentGroupAssessment[];
};

function assessGroup(
  group: VehicleDocumentGroupInput,
  requiestOptionalDocuments: boolean,
): VehicleDocumentGroupAssessment {
  const required = isVehicleDocumentGroupRequired(
    group.key,
    requiestOptionalDocuments,
  );
  const reviewStatuses = group.documents.map((d) =>
    normalizeToReviewStatus(d.status),
  );
  const reviewStatus = pickAggregateReviewStatus(reviewStatuses);
  const satisfied =
    !required || reviewStatuses.some((status) => status === 'ACCEPTED');

  return {
    key: group.key,
    label: group.label,
    required,
    satisfied,
    reviewStatus,
    missing: required && !satisfied,
  };
}

export function assessVehicleDocumentRequirements(input: {
  requiestOptionalDocuments: boolean;
  logBookV5: Array<{ status: string }>;
  inspections: Array<{ status: string }>;
  insurances: Array<{ status: string }>;
  pcoDocs: Array<{ status: string }>;
  permissionLetters: Array<{ status: string }>;
  vehicleSchedules: Array<{ status: string }>;
}): VehicleDocumentRequirementsAssessment {
  const groups = (
    [
      { key: 'logBookV5', documents: input.logBookV5 },
      { key: 'inspections', documents: input.inspections },
      { key: 'insurances', documents: input.insurances },
      { key: 'pcoDocs', documents: input.pcoDocs },
      { key: 'permissionLetters', documents: input.permissionLetters },
      { key: 'vehicleSchedules', documents: input.vehicleSchedules },
    ] as Array<{ key: VehicleDocumentGroupKey; documents: Array<{ status: string }> }>
  ).map((group) =>
    assessGroup(
      {
        key: group.key,
        label: VEHICLE_DOCUMENT_GROUP_LABELS[group.key],
        documents: group.documents,
      },
      input.requiestOptionalDocuments,
    ),
  );

  const missingRequired = groups
    .filter((group) => group.missing)
    .map((group) => group.label);

  return {
    optionalDocumentsRequested: input.requiestOptionalDocuments,
    readyForApproval: missingRequired.length === 0,
    missingRequired,
    groups,
  };
}

export function formatVehicleApprovalBlockedMessage(
  missingRequired: string[],
): string {
  return `Cannot approve vehicle until all required documents are accepted. Missing: ${missingRequired.join(', ')}.`;
}
