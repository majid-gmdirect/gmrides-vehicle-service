import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { VehicleType } from './vehicle-type.enum';

export class UpdateVehicleApprovedDto {
  @ApiProperty({ description: 'Admin approval status', example: true })
  @IsBoolean()
  isApproved: boolean;

  @ApiPropertyOptional({
    description:
      'Vehicle category (Standard, Executive, Luxury, 7 Seater). ' +
      'Set when approving documents so the fleet type is recorded in the panel.',
    enum: VehicleType,
    example: VehicleType.EXECUTIVE,
  })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}

export class UpdateVehicleActiveDto {
  @ApiProperty({ description: 'Vehicle active status', example: true })
  @IsBoolean()
  isActive: boolean;
}

