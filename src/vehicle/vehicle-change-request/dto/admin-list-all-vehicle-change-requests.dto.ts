import { ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleDocumentChangeRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminListAllVehicleChangeRequestsDto {
  @ApiPropertyOptional({
    description: 'Search by driver name, driver id, plate, make, or model',
    example: 'AB12CDE',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: VehicleDocumentChangeRequestStatus })
  @IsOptional()
  @IsEnum(VehicleDocumentChangeRequestStatus)
  status?: VehicleDocumentChangeRequestStatus;

  @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Order by createdAt',
    example: 'desc',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  orderBy?: 'asc' | 'desc' = 'desc';
}
