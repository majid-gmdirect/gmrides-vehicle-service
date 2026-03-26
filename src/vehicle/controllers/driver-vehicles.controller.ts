import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { VehicleService } from '../vehicle.service';
import {
  CreateVehicleDto,
  ListVehiclesQueryDto,
  UpdateVehicleDto,
} from '../dto';
import {
  CreateVehicleSwagger,
  DeleteVehicleSwagger,
  GetVehicleSwagger,
  ListDriverVehiclesSwagger,
  UpdateVehicleSwagger,
} from '../decorators/vehicle-swagger.decorator';

@ApiTags('Driver Vehicles')
@Controller()
export class DriverVehiclesController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post('driver/:driverId/vehicles')
  @CreateVehicleSwagger()
  @Roles('DRIVER', 'ADMIN')
  createVehicle(
    @Param('driverId') driverId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehicleService.createVehicle(driverId, dto, req.user);
  }

  @Get('driver/:driverId/vehicles')
  @ListDriverVehiclesSwagger()
  @Roles('DRIVER', 'ADMIN')
  listDriverVehicles(
    @Param('driverId') driverId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Query() query: ListVehiclesQueryDto,
  ) {
    return this.vehicleService.listVehiclesByDriver(driverId, req.user, query);
  }

  @Get('driver/:driverId/vehicles/:vehicleId')
  @GetVehicleSwagger()
  @Roles('DRIVER', 'ADMIN')
  getDriverVehicle(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.getVehicleByDriver(driverId, vehicleId, req.user);
  }

  @Patch('driver/:driverId/vehicles/:vehicleId')
  @UpdateVehicleSwagger()
  @Roles('DRIVER', 'ADMIN')
  updateVehicle(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicleService.updateVehicle(driverId, vehicleId, dto, req.user);
  }

  @Delete('driver/:driverId/vehicles/:vehicleId')
  @DeleteVehicleSwagger()
  @Roles('DRIVER', 'ADMIN')
  deleteVehicle(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.deleteVehicle(driverId, vehicleId, req.user);
  }
}

