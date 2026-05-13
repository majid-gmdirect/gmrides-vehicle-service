import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VehicleService } from './vehicle.service';
import { AdminVehiclesController } from './controllers/admin-vehicles.controller';
import { DriverVehiclesController } from './controllers/driver-vehicles.controller';
import { VehicleImagesController } from './controllers/vehicle-images.controller';
import { VehicleInspectionsController } from './controllers/vehicle-inspections.controller';
import { VehicleInsurancesController } from './controllers/vehicle-insurances.controller';
import { VehiclePcoDocsController } from './controllers/vehicle-pco-docs.controller';
import { VehicleMetaController } from './controllers/vehicle-meta.controller';
import { VehiclePermissionLettersController } from './controllers/vehicle-permission-letters.controller';
import { AdminVehiclePermissionLettersController } from './controllers/admin-vehicle-permission-letters.controller';
import { VehicleSchedulesController } from './controllers/vehicle-schedules.controller';
import { AdminVehicleSchedulesController } from './controllers/admin-vehicle-schedules.controller';
import { CarApiService } from './car-api.service';

@Module({
  imports: [HttpModule],
  controllers: [
    DriverVehiclesController,
    VehicleImagesController,
    VehicleInspectionsController,
    VehicleInsurancesController,
    VehiclePcoDocsController,
    VehiclePermissionLettersController,
    VehicleSchedulesController,
    VehicleMetaController,
    AdminVehiclesController,
    AdminVehiclePermissionLettersController,
    AdminVehicleSchedulesController,
  ],
  providers: [VehicleService, CarApiService],
  exports: [VehicleService],
})
export class VehicleModule {}

