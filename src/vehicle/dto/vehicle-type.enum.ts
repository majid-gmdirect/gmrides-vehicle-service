/** Service category shown to passengers and used for fleet filtering. */
export enum VehicleType {
  STANDARD = 'STANDARD',
  EXECUTIVE = 'EXECUTIVE',
  LUXURY = 'LUXURY',
  SEVEN_SEATER = 'SEVEN_SEATER',
}

export const VEHICLE_TYPE_VALUES = Object.values(VehicleType);

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  [VehicleType.STANDARD]: 'Standard',
  [VehicleType.EXECUTIVE]: 'Executive',
  [VehicleType.LUXURY]: 'Luxury',
  [VehicleType.SEVEN_SEATER]: '7 Seater',
};
