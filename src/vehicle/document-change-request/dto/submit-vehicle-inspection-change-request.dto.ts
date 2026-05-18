import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateVehicleInspectionDto } from '../../dto/create-vehicle-inspection.dto';

export class SubmitVehicleInspectionChangeRequestDto extends OmitType(
  CreateVehicleInspectionDto,
  ['status', 'rejectedReason'] as const,
) {
  @ApiPropertyOptional({
    description: 'Optional note for the reviewer',
  })
  @IsOptional()
  @IsString()
  driver_note?: string;
}
