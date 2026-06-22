import { Body, Controller, Delete, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import {
  AdminListAllVehicleChangeRequestsDto,
  AdminQueryVehicleChangeRequestsDto,
  AdminReviewVehicleChangeRequestDto,
} from './dto';
import {
  AdminDeleteVehicleChangeRequestSwagger,
  AdminGetVehicleChangeRequestSwagger,
  AdminListAllVehicleChangeRequestsSwagger,
  AdminListDriverVehicleChangeRequestsSwagger,
  AdminListVehicleProfileChangeRequestsSwagger,
  AdminReviewVehicleChangeRequestSwagger,
} from './decorators/vehicle-change-request-swagger.decorator';
import { VehicleChangeRequestService } from './vehicle-change-request.service';

@ApiTags('Admin Vehicle Profile Change Requests')
@ApiBearerAuth()
@Controller('admin')
export class AdminVehicleChangeRequestController {
  constructor(
    private readonly changeRequestService: VehicleChangeRequestService,
  ) {}

  @Get('vehicle-profile-change-requests')
  @Roles('ADMIN')
  @AdminListAllVehicleChangeRequestsSwagger()
  listAll(
    @Query() query: AdminListAllVehicleChangeRequestsDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminListAll(query, req.user);
  }

  @Get('drivers/:driverId/vehicle-change-requests')
  @Roles('ADMIN')
  @AdminListDriverVehicleChangeRequestsSwagger()
  listForDriver(
    @Param('driverId') driverId: string,
    @Query() query: AdminQueryVehicleChangeRequestsDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminListForDriver(driverId, query, req.user);
  }

  @Get('vehicles/:vehicleId/vehicle-change-requests')
  @Roles('ADMIN')
  @AdminListVehicleProfileChangeRequestsSwagger()
  listForVehicle(
    @Param('vehicleId') vehicleId: string,
    @Query() query: AdminQueryVehicleChangeRequestsDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminListForVehicle(vehicleId, query, req.user);
  }

  @Get('vehicle-profile-change-requests/:requestId')
  @Roles('ADMIN')
  @AdminGetVehicleChangeRequestSwagger()
  findOne(
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminFindOne(requestId, req.user);
  }

  @Patch('vehicle-profile-change-requests/:requestId/review')
  @Roles('ADMIN')
  @AdminReviewVehicleChangeRequestSwagger()
  review(
    @Param('requestId') requestId: string,
    @Body() dto: AdminReviewVehicleChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminReview(requestId, dto, req.user);
  }

  @Delete('vehicle-profile-change-requests/:requestId')
  @Roles('ADMIN')
  @AdminDeleteVehicleChangeRequestSwagger()
  remove(
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminRemove(requestId, req.user);
  }
}
