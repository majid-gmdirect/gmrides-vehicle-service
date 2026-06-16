import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateLogBookV5Dto, UpdateLogBookV5Dto } from '../dto';
import {
  CreateLogBookV5Swagger,
  DeleteLogBookV5Swagger,
  GetLogBookV5Swagger,
  ListLogBookV5Swagger,
  UpdateLogBookV5Swagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Vehicle Log Book V5')
@Controller()
export class VehicleLogBookV5Controller {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('driver/:driverId/vehicles/:vehicleId/log-book-v5')
  @Roles('DRIVER', 'ADMIN')
  @ListLogBookV5Swagger()
  list(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.listLogBookV5(driverId, vehicleId, req.user);
  }

  @Get('driver/:driverId/vehicles/:vehicleId/log-book-v5/:logBookV5Id')
  @Roles('DRIVER', 'ADMIN')
  @GetLogBookV5Swagger()
  getOne(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('logBookV5Id') logBookV5Id: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.getLogBookV5(
      driverId,
      vehicleId,
      logBookV5Id,
      req.user,
    );
  }

  @Post('driver/:driverId/vehicles/:vehicleId/log-book-v5')
  @Roles('DRIVER', 'ADMIN')
  @CreateLogBookV5Swagger()
  create(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateLogBookV5Dto,
  ) {
    return this.vehicleService.createLogBookV5(driverId, vehicleId, dto, req.user);
  }

  @Patch('driver/:driverId/vehicles/:vehicleId/log-book-v5/:logBookV5Id')
  @Roles('DRIVER', 'ADMIN')
  @UpdateLogBookV5Swagger()
  update(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('logBookV5Id') logBookV5Id: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: UpdateLogBookV5Dto,
  ) {
    return this.vehicleService.updateLogBookV5(
      driverId,
      vehicleId,
      logBookV5Id,
      dto,
      req.user,
    );
  }

  @Delete('driver/:driverId/vehicles/:vehicleId/log-book-v5/:logBookV5Id')
  @Roles('DRIVER', 'ADMIN')
  @DeleteLogBookV5Swagger()
  remove(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('logBookV5Id') logBookV5Id: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.deleteLogBookV5(
      driverId,
      vehicleId,
      logBookV5Id,
      req.user,
    );
  }
}
