import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
}

