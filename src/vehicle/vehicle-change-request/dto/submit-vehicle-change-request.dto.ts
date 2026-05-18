import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateVehicleDto } from '../../dto/create-vehicle.dto';

export class SubmitVehicleChangeRequestDto extends OmitType(CreateVehicleDto, [] as const) {
  @ApiPropertyOptional({ description: 'Optional note for the reviewer' })
  @IsOptional()
  @IsString()
  driver_note?: string;
}
