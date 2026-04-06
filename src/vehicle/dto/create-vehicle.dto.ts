import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class UploadFilePayloadDto {
  @ApiProperty({ example: 'file-id' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'https://assets.example.com/uploads/file.jpg' })
  @IsString()
  url: string;
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

