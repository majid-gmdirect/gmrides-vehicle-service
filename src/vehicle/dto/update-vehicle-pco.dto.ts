import { PartialType } from '@nestjs/swagger';
import { CreateVehiclePcoDocumentDto } from './create-vehicle-pco.dto';

export class UpdateVehiclePcoDocumentDto extends PartialType(
  CreateVehiclePcoDocumentDto,
) {}

