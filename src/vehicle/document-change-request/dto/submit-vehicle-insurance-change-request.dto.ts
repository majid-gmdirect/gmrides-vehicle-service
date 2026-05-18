import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateVehicleInsuranceDto } from '../../dto/create-vehicle-insurance.dto';

export class SubmitVehicleInsuranceChangeRequestDto extends OmitType(
  CreateVehicleInsuranceDto,
  ['status', 'rejectedReason'] as const,
) {
  @ApiPropertyOptional({ description: 'Optional note for the reviewer' })
  @IsOptional()
  @IsString()
  driver_note?: string;
}
