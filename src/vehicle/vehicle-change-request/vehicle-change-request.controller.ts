import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { SubmitVehicleChangeRequestDto } from './dto';
import {
  CancelVehicleChangeRequestSwagger,
  GetVehicleChangeRequestSwagger,
  ListVehicleChangeRequestsSwagger,
  SubmitVehicleChangeRequestSwagger,
} from './decorators/vehicle-change-request-swagger.decorator';
import { VehicleChangeRequestService } from './vehicle-change-request.service';

@ApiTags('Vehicle Profile Change Requests')
@Controller()
export class VehicleChangeRequestController {
  constructor(
    private readonly changeRequestService: VehicleChangeRequestService,
  ) {}

  @Post('driver/:driverId/vehicles/:vehicleId/change-requests')
  @Roles('DRIVER')
  @SubmitVehicleChangeRequestSwagger()
  submit(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: SubmitVehicleChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.submit(driverId, vehicleId, dto, req.user);
  }

  @Get('driver/:driverId/vehicles/:vehicleId/change-requests')
  @Roles('DRIVER', 'ADMIN')
  @ListVehicleChangeRequestsSwagger()
  list(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.listForVehicle(driverId, vehicleId, req.user);
  }

  @Get('driver/:driverId/vehicle-change-requests/:requestId')
  @Roles('DRIVER', 'ADMIN')
  @GetVehicleChangeRequestSwagger()
  findOne(
    @Param('driverId') driverId: string,
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.findOne(driverId, requestId, req.user);
  }

  @Patch('driver/:driverId/vehicle-change-requests/:requestId/cancel')
  @Roles('DRIVER')
  @CancelVehicleChangeRequestSwagger()
  cancel(
    @Param('driverId') driverId: string,
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.cancel(driverId, requestId, req.user);
  }
}
