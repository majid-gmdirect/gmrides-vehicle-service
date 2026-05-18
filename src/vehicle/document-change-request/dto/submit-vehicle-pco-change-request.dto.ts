import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateVehiclePcoDocumentDto } from '../../dto/create-vehicle-pco.dto';

export class SubmitVehiclePcoChangeRequestDto extends OmitType(
  CreateVehiclePcoDocumentDto,
  ['status', 'rejectedReason'] as const,
) {
  @ApiPropertyOptional({ description: 'Optional note for the reviewer' })
  @IsOptional()
  @IsString()
  driver_note?: string;
}
