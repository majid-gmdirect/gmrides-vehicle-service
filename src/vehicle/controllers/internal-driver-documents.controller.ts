import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalRoute } from '../../auth/internal.decorator';
import { VehicleService } from '../vehicle.service';
import { DriverDocumentExpiryQueryDto } from '../dto/driver-document-expiry-query.dto';

@ApiExcludeController()
@Controller('internal/driver')
export class InternalDriverDocumentsController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('expired-document-driver-ids')
  @InternalRoute()
  getExpiredDocumentDriverIds() {
    return this.vehicleService.getInternalExpiredDocumentDriverIds();
  }

  @Get(':driverId/document-status')
  @InternalRoute()
  getDriverVehicleDocumentStatus(@Param('driverId') driverId: string) {
    return this.vehicleService.getInternalDriverVehicleDocumentStatus(driverId);
  }

  @Get(':driverId/document-expiry')
  @InternalRoute()
  getDriverDocumentExpiry(
    @Param('driverId') driverId: string,
    @Query() query: DriverDocumentExpiryQueryDto,
  ) {
    return this.vehicleService.getInternalDriverDocumentExpiry(
      driverId,
      query.horizonDays,
    );
  }

  @Delete(':driverId/vehicles')
  @InternalRoute()
  deleteAllVehiclesForDriver(@Param('driverId') driverId: string) {
    return this.vehicleService.deleteAllVehiclesForDriver(driverId);
  }

  @Patch(':driverId/vehicles/archive')
  @InternalRoute()
  archiveAllVehiclesForDriver(@Param('driverId') driverId: string) {
    return this.vehicleService.archiveAllVehiclesForDriver(driverId);
  }

  @Patch(':driverId/vehicles/restore')
  @InternalRoute()
  restoreAllVehiclesForDriver(@Param('driverId') driverId: string) {
    return this.vehicleService.restoreAllVehiclesForDriver(driverId);
  }
}
