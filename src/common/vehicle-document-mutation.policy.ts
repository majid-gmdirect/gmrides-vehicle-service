import { ConflictException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';

export const VEHICLE_DOCUMENT_LOCKED_ERROR_CODE = 'DOCUMENT_LOCKED';

export class VehicleDocumentLockedException extends ConflictException {
  constructor() {
    super({
      message:
        'Document is accepted. Submit a change request instead of updating it directly.',
      code: VEHICLE_DOCUMENT_LOCKED_ERROR_CODE,
    });
  }
}

/** Drivers may mutate live documents only while PENDING or REJECTED. */
export function assertDriverMayMutateLiveVehicleDocument(
  isAdmin: boolean,
  status: DocumentStatus,
): void {
  if (isAdmin) return;
  if (status === DocumentStatus.ACCEPTED) {
    throw new VehicleDocumentLockedException();
  }
}
