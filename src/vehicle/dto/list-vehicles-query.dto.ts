import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListVehiclesQueryDto {
  @ApiPropertyOptional({ description: 'Search by plate/make/model', example: 'pri' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 10, default: 10 })
  @IsOptional()
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
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional({ description: 'Filter active status', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

