import { PartialType } from '@nestjs/swagger';
import { CreateVehicleInsuranceDto } from './create-vehicle-insurance.dto';

export class UpdateVehicleInsuranceDto extends PartialType(CreateVehicleInsuranceDto) {}

