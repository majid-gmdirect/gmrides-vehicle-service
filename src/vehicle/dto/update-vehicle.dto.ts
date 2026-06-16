import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @ApiPropertyOptional({
    description:
      'Admin-only: when true, driver must upload permission letter and vehicle schedule.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requiestOptionalDocuments?: boolean;
}

