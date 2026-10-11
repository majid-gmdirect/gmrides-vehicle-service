import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { VehicleType } from './vehicle-type.enum';

/**
 * A file reference from upload-service. The id is checked with
 * upload-service and its url (or none, for a private file) is stored.
 */
class UploadFilePayloadDto {
  @ApiProperty({ example: 'file-id' })
  @IsString()
  id: string;

  @ApiPropertyOptional({
    description:
      'Public URL. Ignored (upload-service is asked); absent for a private file.',
    example: 'https://assets.example.com/uploads/file.jpg',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    description: 'true for a file in the private bucket (no url).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

export class CreateVehicleDto {
  @ApiProperty({ description: 'Vehicle make', example: 'Toyota' })
  @IsString()
  make: string;

  @ApiProperty({ description: 'Vehicle model', example: 'Prius' })
  @IsString()
  model: string;

  @ApiProperty({ description: 'Vehicle year', example: 2020 })
  @IsInt()
  @Min(1950)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({ description: 'Vehicle color', example: 'Black' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ description: 'Plate number', example: 'AB12CDE' })
  @IsString()
  plateNumber: string;

  @ApiProperty({
    description: 'Passenger-facing vehicle category',
    enum: VehicleType,
    example: VehicleType.STANDARD,
  })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiPropertyOptional({
    description: 'Whether vehicle is active (driver can toggle)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Permission letter file (from Upload Service)',
    example: { id: 'file-id', url: 'https://assets.example.com/uploads/permission.pdf' },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UploadFilePayloadDto)
  permission_letter?: UploadFilePayloadDto;

  @ApiPropertyOptional({
    description: 'Vehicle schedule file (from Upload Service)',
    example: { id: 'file-id', url: 'https://assets.example.com/uploads/schedule.pdf' },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UploadFilePayloadDto)
  vehicle_schedule?: UploadFilePayloadDto;
}

