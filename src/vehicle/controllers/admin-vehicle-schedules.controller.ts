import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { AdminReviewVehicleScheduleDto } from '../dto';
import {
  AdminGetVehicleScheduleSwagger,
  AdminListVehicleSchedulesSwagger,
  AdminReviewVehicleScheduleSwagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Admin Vehicle Schedules')
@Controller()
export class AdminVehicleSchedulesController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('admin/vehicles/:vehicleId/schedules')
  @Roles('ADMIN')
  @AdminListVehicleSchedulesSwagger()
  list(@Param('vehicleId') vehicleId: string) {
    return this.vehicleService.adminListVehicleSchedules(vehicleId);
  }

  @Get('admin/vehicles/:vehicleId/schedules/:scheduleId')
  @Roles('ADMIN')
  @AdminGetVehicleScheduleSwagger()
  getOne(
    @Param('vehicleId') vehicleId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.vehicleService.adminGetVehicleSchedule(vehicleId, scheduleId);
  }

  @Patch('admin/vehicles/:vehicleId/schedules/:scheduleId/review')
  @Roles('ADMIN')
  @AdminReviewVehicleScheduleSwagger()
  review(
    @Param('vehicleId') vehicleId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: AdminReviewVehicleScheduleDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.adminReviewVehicleSchedule(vehicleId, scheduleId, dto, req.user);
  }
}

