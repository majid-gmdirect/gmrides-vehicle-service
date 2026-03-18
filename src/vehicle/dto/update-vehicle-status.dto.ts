import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateVehicleApprovedDto {
  @ApiProperty({ description: 'Admin approval status', example: true })
  @IsBoolean()
  isApproved: boolean;
}

export class UpdateVehicleActiveDto {
  @ApiProperty({ description: 'Vehicle active status', example: true })
  @IsBoolean()
  isActive: boolean;
}

