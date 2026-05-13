import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class AdminReviewVehicleScheduleDto {
  @ApiPropertyOptional({
    description: 'Admin review status',
    enum: DocumentStatus,
    example: DocumentStatus.ACCEPTED,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Rejection reason (when status is REJECTED)',
    example: 'Schedule is missing required pages.',
  })
  @IsOptional()
  @IsString()
  rejectedReason?: string;
}

