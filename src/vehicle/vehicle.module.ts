import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VehicleService } from './vehicle.service';
import { AdminVehiclesController } from './controllers/admin-vehicles.controller';
import { DriverVehiclesController } from './controllers/driver-vehicles.controller';
import { VehicleImagesController } from './controllers/vehicle-images.controller';
import { VehicleInspectionsController } from './controllers/vehicle-inspections.controller';
import { VehicleInsurancesController } from './controllers/vehicle-insurances.controller';
import { VehiclePcoDocsController } from './controllers/vehicle-pco-docs.controller';

@Module({
  imports: [HttpModule],
  controllers: [
    DriverVehiclesController,
    VehicleImagesController,
    VehicleInspectionsController,
    VehicleInsurancesController,
    VehiclePcoDocsController,
    AdminVehiclesController,
  ],
  providers: [VehicleService],
  exports: [VehicleService],
})
export class VehicleModule {}

