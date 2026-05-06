import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateVehicleInsuranceDto {
  @ApiProperty({ description: 'Insurance provider', example: 'AXA' })
  @IsString()
  provider: string;

  @ApiProperty({ description: 'Policy number', example: 'POL-123456' })
  @IsString()
  policyNumber: string;

  @ApiProperty({ description: 'Start date', example: '2026-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'End date', example: '2027-01-01' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Insurance document payload (Upload Service)',
    example: { id: 'file-id', url: 'https://storage.example.com/insurance.pdf' },
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

