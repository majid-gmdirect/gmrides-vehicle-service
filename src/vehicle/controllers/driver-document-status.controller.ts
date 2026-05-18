import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { VehicleService } from '../vehicle.service';
import { DriverDocumentStatusSwagger } from '../decorators/driver-document-status.swagger';

@ApiTags('Driver document status')
@Controller()
export class DriverDocumentStatusController {
  constructor(private readonly vehicleService: VehicleService) {}

  /**
   * Vehicle documents only. For full driver + vehicle status use
   * GET /api/users/driver/:driverId/document-status
   */
  @Get('driver/:driverId/document-status')
  @DriverDocumentStatusSwagger()
  @Roles('DRIVER', 'ADMIN')
  getDriverVehicleDocumentStatus(
    @Param('driverId') driverId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.getDriverVehicleDocumentStatus(
      driverId,
      req.user,
    );
  }
}
