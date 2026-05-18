import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { UpdateVehicleDto } from '../../dto/update-vehicle.dto';

/**
 * Partial updates only; service merges with the live vehicle row.
 * Extends UpdateVehicleDto (not PartialType(CreateVehicleDto) again) so
 * @IsOptional() is preserved on all vehicle fields — re-wrapping PartialType
 * on a subclass drops optional validation for inherited properties.
 */
export class SubmitVehicleChangeRequestDto extends UpdateVehicleDto {
  @ApiPropertyOptional({ description: 'Optional note for the reviewer' })
  @IsOptional()
  @IsString()
  driver_note?: string;
}
