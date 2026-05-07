import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateVehiclePcoDocumentDto {
  @ApiPropertyOptional({ description: 'PCO badge number', example: 'PCO-12345' })
  @IsOptional()
  @IsString()
  badgeNumber?: string;

  @ApiPropertyOptional({ description: 'Issue date', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ description: 'Expiry date', example: '2027-01-01' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({
    description: 'PCO document payload (Upload Service)',
    example: { id: 'file-id', url: 'https://storage.example.com/pco.pdf' },
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

  @ApiPropertyOptional({
    description: 'Rejection reason (required when status is REJECTED)',
    example: 'Expired document',
  })
  @IsOptional()
  @IsString()
  rejectedReason?: string;
}

