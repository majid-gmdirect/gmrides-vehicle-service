import { Body, Controller, Delete, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateVehicleImageDto } from '../dto';
import {
  AddVehicleImageSwagger,
  DeleteVehicleImageSwagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Vehicle Images')
@Controller()
export class VehicleImagesController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post('driver/:driverId/vehicles/:vehicleId/images')
  @Roles('DRIVER', 'ADMIN')
  @AddVehicleImageSwagger()
  addImage(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateVehicleImageDto,
  ) {
    return this.vehicleService.addImage(driverId, vehicleId, dto, req.user);
  }

  @Delete('driver/:driverId/vehicles/:vehicleId/images/:imageId')
  @Roles('DRIVER', 'ADMIN')
  @DeleteVehicleImageSwagger()
  deleteImage(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('imageId') imageId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.deleteImage(driverId, vehicleId, imageId, req.user);
  }
}

