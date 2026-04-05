import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import {
  CreateVehiclePcoDocumentDto,
  UpdateVehiclePcoDocumentDto,
} from '../dto';
import {
  CreateVehiclePcoDocSwagger,
  DeleteVehiclePcoDocSwagger,
  GetVehiclePcoDocSwagger,
  ListVehiclePcoDocsSwagger,
  UpdateVehiclePcoDocSwagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Vehicle PCO Documents')
@Controller()
export class VehiclePcoDocsController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('driver/:driverId/vehicles/:vehicleId/pco-docs')
  @Roles('DRIVER', 'ADMIN')
  @ListVehiclePcoDocsSwagger()
  listPcoDocs(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.listPcoDocs(driverId, vehicleId, req.user);
  }

  @Get('driver/:driverId/vehicles/:vehicleId/pco-docs/:pcoDocId')
  @Roles('DRIVER', 'ADMIN')
  @GetVehiclePcoDocSwagger()
  getPcoDoc(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('pcoDocId') pcoDocId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.getPcoDoc(
      driverId,
      vehicleId,
      pcoDocId,
      req.user,
    );
  }

  @Post('driver/:driverId/vehicles/:vehicleId/pco-docs')
  @Roles('DRIVER', 'ADMIN')
  @CreateVehiclePcoDocSwagger()
  createPcoDoc(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateVehiclePcoDocumentDto,
  ) {
    return this.vehicleService.createPcoDoc(driverId, vehicleId, dto, req.user);
  }

  @Patch('driver/:driverId/vehicles/:vehicleId/pco-docs/:pcoDocId')
  @Roles('DRIVER', 'ADMIN')
  @UpdateVehiclePcoDocSwagger()
  updatePcoDoc(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('pcoDocId') pcoDocId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: UpdateVehiclePcoDocumentDto,
  ) {
    return this.vehicleService.updatePcoDoc(
      driverId,
      vehicleId,
      pcoDocId,
      dto,
      req.user,
    );
  }

  @Delete('driver/:driverId/vehicles/:vehicleId/pco-docs/:pcoDocId')
  @Roles('DRIVER', 'ADMIN')
  @DeleteVehiclePcoDocSwagger()
  deletePcoDoc(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('pcoDocId') pcoDocId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.deletePcoDoc(driverId, vehicleId, pcoDocId, req.user);
  }
}

