import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateVehicleScheduleDto, UpdateVehicleScheduleDto } from '../dto';
import {
  CreateVehicleScheduleSwagger,
  DeleteVehicleScheduleSwagger,
  GetVehicleScheduleSwagger,
  ListVehicleSchedulesSwagger,
  UpdateVehicleScheduleSwagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Vehicle Schedules')
@Controller()
export class VehicleSchedulesController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('driver/:driverId/vehicles/:vehicleId/schedules')
  @Roles('DRIVER', 'ADMIN')
  @ListVehicleSchedulesSwagger()
  list(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.listVehicleSchedules(driverId, vehicleId, req.user);
  }

  @Get('driver/:driverId/vehicles/:vehicleId/schedules/:scheduleId')
  @Roles('DRIVER', 'ADMIN')
  @GetVehicleScheduleSwagger()
  getOne(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('scheduleId') scheduleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.getVehicleSchedule(driverId, vehicleId, scheduleId, req.user);
  }

  @Post('driver/:driverId/vehicles/:vehicleId/schedules')
  @Roles('DRIVER', 'ADMIN')
  @CreateVehicleScheduleSwagger()
  create(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateVehicleScheduleDto,
  ) {
    return this.vehicleService.createVehicleSchedule(driverId, vehicleId, dto, req.user);
  }

  @Patch('driver/:driverId/vehicles/:vehicleId/schedules/:scheduleId')
  @Roles('DRIVER', 'ADMIN')
  @UpdateVehicleScheduleSwagger()
  update(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('scheduleId') scheduleId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: UpdateVehicleScheduleDto,
  ) {
    return this.vehicleService.updateVehicleSchedule(
      driverId,
      vehicleId,
      scheduleId,
      dto,
      req.user,
    );
  }

  @Delete('driver/:driverId/vehicles/:vehicleId/schedules/:scheduleId')
  @Roles('DRIVER', 'ADMIN')
  @DeleteVehicleScheduleSwagger()
  remove(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('scheduleId') scheduleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.deleteVehicleSchedule(driverId, vehicleId, scheduleId, req.user);
  }
}

