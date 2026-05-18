import { Body, Controller, Delete, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import {
  AdminQueryVehicleChangeRequestsDto,
  AdminReviewVehicleChangeRequestDto,
} from './dto';
import { VehicleChangeRequestService } from './vehicle-change-request.service';

@ApiTags('Admin Vehicle Profile Change Requests')
@ApiBearerAuth()
@Controller('admin')
export class AdminVehicleChangeRequestController {
  constructor(
    private readonly changeRequestService: VehicleChangeRequestService,
  ) {}

  @Get('drivers/:driverId/vehicle-change-requests')
  @Roles('ADMIN')
  listForDriver(
    @Param('driverId') driverId: string,
    @Query() query: AdminQueryVehicleChangeRequestsDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminListForDriver(driverId, query, req.user);
  }

  @Get('vehicles/:vehicleId/vehicle-change-requests')
  @Roles('ADMIN')
  @ApiParam({ name: 'vehicleId', type: String })
  listForVehicle(
    @Param('vehicleId') vehicleId: string,
    @Query() query: AdminQueryVehicleChangeRequestsDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminListForVehicle(vehicleId, query, req.user);
  }

  @Get('vehicle-profile-change-requests/:requestId')
  @Roles('ADMIN')
  findOne(
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminFindOne(requestId, req.user);
  }

  @Patch('vehicle-profile-change-requests/:requestId/review')
  @Roles('ADMIN')
  review(
    @Param('requestId') requestId: string,
    @Body() dto: AdminReviewVehicleChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminReview(requestId, dto, req.user);
  }

  @Delete('vehicle-profile-change-requests/:requestId')
  @Roles('ADMIN')
  @ApiParam({ name: 'requestId', type: String })
  remove(
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminRemove(requestId, req.user);
  }
}
