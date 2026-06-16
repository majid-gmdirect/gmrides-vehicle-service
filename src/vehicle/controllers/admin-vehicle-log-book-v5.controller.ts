import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { AdminReviewLogBookV5Dto } from '../dto';
import {
  AdminGetLogBookV5Swagger,
  AdminListLogBookV5Swagger,
  AdminReviewLogBookV5Swagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Admin Vehicle Log Book V5')
@Controller()
export class AdminVehicleLogBookV5Controller {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('admin/vehicles/:vehicleId/log-book-v5')
  @Roles('ADMIN')
  @AdminListLogBookV5Swagger()
  list(@Param('vehicleId') vehicleId: string) {
    return this.vehicleService.adminListLogBookV5(vehicleId);
  }

  @Get('admin/vehicles/:vehicleId/log-book-v5/:logBookV5Id')
  @Roles('ADMIN')
  @AdminGetLogBookV5Swagger()
  getOne(
    @Param('vehicleId') vehicleId: string,
    @Param('logBookV5Id') logBookV5Id: string,
  ) {
    return this.vehicleService.adminGetLogBookV5(vehicleId, logBookV5Id);
  }

  @Patch('admin/vehicles/:vehicleId/log-book-v5/:logBookV5Id/review')
  @Roles('ADMIN')
  @AdminReviewLogBookV5Swagger()
  review(
    @Param('vehicleId') vehicleId: string,
    @Param('logBookV5Id') logBookV5Id: string,
    @Body() dto: AdminReviewLogBookV5Dto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.adminReviewLogBookV5(
      vehicleId,
      logBookV5Id,
      dto,
      req.user,
    );
  }
}
