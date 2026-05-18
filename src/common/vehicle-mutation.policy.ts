import { ConflictException } from '@nestjs/common';

export const VEHICLE_LOCKED_ERROR_CODE = 'VEHICLE_LOCKED';

export class VehicleLockedException extends ConflictException {
  constructor() {
    super({
      message:
        'Vehicle is approved. Submit a change request instead of updating it directly.',
      code: VEHICLE_LOCKED_ERROR_CODE,
    });
  }
}

/** Drivers may mutate live vehicles only while not yet approved by admin. */
export function assertDriverMayMutateLiveVehicle(
  isAdmin: boolean,
  isApproved: boolean,
): void {
  if (isAdmin) return;
  if (isApproved) {
    throw new VehicleLockedException();
  }
}
