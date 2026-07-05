import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { VehicleType } from './vehicle-type.enum';

export class ListVehiclesQueryDto {
  @ApiPropertyOptional({ description: 'Search by plate/make/model', example: 'pri' })
  @IsOptional()
  @IsString()
  search?: string;

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

  @ApiPropertyOptional({ description: 'Filter approved status', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true') return true;
      if (v === 'false') return false;
    }
    return value;
  })
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional({ description: 'Filter active status', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true') return true;
      if (v === 'false') return false;
    }
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by vehicle category',
    enum: VehicleType,
    example: VehicleType.LUXURY,
  })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional({
    description:
      'When true, only vehicles with at least one expired accepted document (inspection, insurance, or PCO). When false, only vehicles with no expired documents.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true') return true;
      if (v === 'false') return false;
    }
    return value;
  })
  @IsBoolean()
  isExpired?: boolean;
}

