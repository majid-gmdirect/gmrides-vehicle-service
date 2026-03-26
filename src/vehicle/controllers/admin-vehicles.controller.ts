import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { ListVehiclesQueryDto, UpdateVehicleActiveDto, UpdateVehicleApprovedDto } from '../dto';
import {
  AdminApproveVehicleSwagger,
  AdminListVehiclesSwagger,
  AdminSetVehicleActiveSwagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Admin Vehicles')
@Controller()
export class AdminVehiclesController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('admin/vehicles')
  @AdminListVehiclesSwagger()
  @Roles('ADMIN')
  adminList(@Query() query: ListVehiclesQueryDto) {
    return this.vehicleService.adminListVehicles(query);
  }

  @Patch('admin/vehicles/:vehicleId/approval')
  @AdminApproveVehicleSwagger()
  @Roles('ADMIN')
  adminApprove(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: UpdateVehicleApprovedDto,
  ) {
    return this.vehicleService.adminApproveVehicle(vehicleId, dto);
  }

  @Patch('admin/vehicles/:vehicleId/active')
  @AdminSetVehicleActiveSwagger()
  @Roles('ADMIN')
  adminSetActive(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: UpdateVehicleActiveDto,
  ) {
    return this.vehicleService.adminSetActive(vehicleId, dto);
  }
}

