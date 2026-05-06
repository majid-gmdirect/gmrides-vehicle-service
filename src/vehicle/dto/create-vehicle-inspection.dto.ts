import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateVehicleInspectionDto {
  @ApiProperty({
    description: 'Inspection type',
    example: 'MOT',
  })
  @IsString()
  inspectionType: string;

  @ApiProperty({
    description: 'Inspection date (ISO 8601 date or datetime)',
    example: '2026-03-01',
  })
  @IsDateString()
  inspectionDate: string;

  @ApiPropertyOptional({
    description: 'Expiry date (ISO 8601 date or datetime)',
    example: '2027-03-01',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({
    description: 'Inspection document payload (Upload Service)',
    example: { id: 'file-id', url: 'https://storage.example.com/mot.pdf' },
  })
  @IsOptional()
  @IsObject()
  document?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Admin review status',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
    example: DocumentStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

