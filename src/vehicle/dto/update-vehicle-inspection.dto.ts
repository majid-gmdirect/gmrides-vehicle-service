import { PartialType } from '@nestjs/swagger';
import { CreateVehicleInspectionDto } from './create-vehicle-inspection.dto';

export class UpdateVehicleInspectionDto extends PartialType(
  CreateVehicleInspectionDto,
) {}

