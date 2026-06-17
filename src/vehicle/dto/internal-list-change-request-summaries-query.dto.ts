import { ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleDocumentChangeRequestStatus, VehicleDocumentKind } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class InternalListChangeRequestSummariesQueryDto {
  @ApiPropertyOptional({ enum: VehicleDocumentChangeRequestStatus })
  @IsOptional()
  @IsEnum(VehicleDocumentChangeRequestStatus)
  status?: VehicleDocumentChangeRequestStatus;

  @ApiPropertyOptional({ enum: VehicleDocumentKind })
  @IsOptional()
  @IsEnum(VehicleDocumentKind)
  targetType?: VehicleDocumentKind;
}
