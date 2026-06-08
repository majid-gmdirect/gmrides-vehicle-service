import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalRoute } from '../../auth/internal.decorator';
import { VehicleService } from '../vehicle.service';

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
}
