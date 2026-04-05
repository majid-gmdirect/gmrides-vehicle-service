import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import {
  CreateVehicleInsuranceDto,
  UpdateVehicleInsuranceDto,
} from '../dto';
import {
  CreateVehicleInsuranceSwagger,
  DeleteVehicleInsuranceSwagger,
  GetVehicleInsuranceSwagger,
  ListVehicleInsurancesSwagger,
  UpdateVehicleInsuranceSwagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Vehicle Insurances')
@Controller()
export class VehicleInsurancesController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('driver/:driverId/vehicles/:vehicleId/insurances')
  @Roles('DRIVER', 'ADMIN')
  @ListVehicleInsurancesSwagger()
  listInsurances(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.listInsurances(driverId, vehicleId, req.user);
  }

  @Get('driver/:driverId/vehicles/:vehicleId/insurances/:insuranceId')
  @Roles('DRIVER', 'ADMIN')
  @GetVehicleInsuranceSwagger()
  getInsurance(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('insuranceId') insuranceId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.getInsurance(
      driverId,
      vehicleId,
      insuranceId,
      req.user,
    );
  }

  @Post('driver/:driverId/vehicles/:vehicleId/insurances')
  @Roles('DRIVER', 'ADMIN')
  @CreateVehicleInsuranceSwagger()
  createInsurance(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateVehicleInsuranceDto,
  ) {
    return this.vehicleService.createInsurance(driverId, vehicleId, dto, req.user);
  }

  @Patch('driver/:driverId/vehicles/:vehicleId/insurances/:insuranceId')
  @Roles('DRIVER', 'ADMIN')
  @UpdateVehicleInsuranceSwagger()
  updateInsurance(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('insuranceId') insuranceId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: UpdateVehicleInsuranceDto,
  ) {
    return this.vehicleService.updateInsurance(
      driverId,
      vehicleId,
      insuranceId,
      dto,
      req.user,
    );
  }

  @Delete('driver/:driverId/vehicles/:vehicleId/insurances/:insuranceId')
  @Roles('DRIVER', 'ADMIN')
  @DeleteVehicleInsuranceSwagger()
  deleteInsurance(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('insuranceId') insuranceId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.deleteInsurance(
      driverId,
      vehicleId,
      insuranceId,
      req.user,
    );
  }
}

