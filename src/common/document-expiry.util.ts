export const MS_DAY = 86_400_000;

export type DocumentExpiryScope = 'DRIVER' | 'VEHICLE';

export type VehicleDocumentExpiryType =
  | 'VEHICLE_INSPECTION'
  | 'VEHICLE_INSURANCE'
  | 'VEHICLE_PCO';

export interface DocumentExpiryItem {
  scope: DocumentExpiryScope;
  documentType: VehicleDocumentExpiryType;
  documentId: string;
  label: string;
  expiryDate: string;
  daysUntilExpiry: number;
  reviewStatus: 'ACCEPTED';
  vehicleId: string;
  plateNumber: string;
  vehicleLabel: string;
  inspectionType?: string | null;
}

export type ExpiryBucket = 'expired' | 'expiringSoon';

export function daysUntilExpiry(expiry: Date, reference: Date): number {
  return Math.ceil((expiry.getTime() - reference.getTime()) / MS_DAY);
}

export function classifyExpiryBucket(
  expiry: Date,
  reference: Date,
  horizonDays: number,
): ExpiryBucket | null {
  const horizon = new Date(reference.getTime() + horizonDays * MS_DAY);
  if (expiry.getTime() < reference.getTime()) return 'expired';
  if (expiry.getTime() <= horizon.getTime()) return 'expiringSoon';
  return null;
}

export function sortByDaysUntilExpiry<T extends { daysUntilExpiry: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}
