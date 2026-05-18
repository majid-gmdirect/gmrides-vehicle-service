import { ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleDocumentChangeRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class AdminQueryVehicleChangeRequestsDto {
  @ApiPropertyOptional({ enum: VehicleDocumentChangeRequestStatus })
  @IsOptional()
  @IsEnum(VehicleDocumentChangeRequestStatus)
  status?: VehicleDocumentChangeRequestStatus;
}
