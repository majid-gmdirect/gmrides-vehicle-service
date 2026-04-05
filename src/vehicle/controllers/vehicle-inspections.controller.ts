import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import {
  CreateVehicleInspectionDto,
  UpdateVehicleInspectionDto,
} from '../dto';
import {
  CreateVehicleInspectionSwagger,
  DeleteVehicleInspectionSwagger,
  GetVehicleInspectionSwagger,
  ListVehicleInspectionsSwagger,
  UpdateVehicleInspectionSwagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Vehicle Inspections')
@Controller()
export class VehicleInspectionsController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('driver/:driverId/vehicles/:vehicleId/inspections')
  @Roles('DRIVER', 'ADMIN')
  @ListVehicleInspectionsSwagger()
  listInspections(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.listInspections(driverId, vehicleId, req.user);
  }

  @Get('driver/:driverId/vehicles/:vehicleId/inspections/:inspectionId')
  @Roles('DRIVER', 'ADMIN')
  @GetVehicleInspectionSwagger()
  getInspection(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('inspectionId') inspectionId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.getInspection(
      driverId,
      vehicleId,
      inspectionId,
      req.user,
    );
  }

  @Post('driver/:driverId/vehicles/:vehicleId/inspections')
  @Roles('DRIVER', 'ADMIN')
  @CreateVehicleInspectionSwagger()
  createInspection(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateVehicleInspectionDto,
  ) {
    return this.vehicleService.createInspection(driverId, vehicleId, dto, req.user);
  }

  @Patch('driver/:driverId/vehicles/:vehicleId/inspections/:inspectionId')
  @Roles('DRIVER', 'ADMIN')
  @UpdateVehicleInspectionSwagger()
  updateInspection(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('inspectionId') inspectionId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: UpdateVehicleInspectionDto,
  ) {
    return this.vehicleService.updateInspection(
      driverId,
      vehicleId,
      inspectionId,
      dto,
      req.user,
    );
  }

  @Delete('driver/:driverId/vehicles/:vehicleId/inspections/:inspectionId')
  @Roles('DRIVER', 'ADMIN')
  @DeleteVehicleInspectionSwagger()
  deleteInspection(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('inspectionId') inspectionId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.deleteInspection(
      driverId,
      vehicleId,
      inspectionId,
      req.user,
    );
  }
}

