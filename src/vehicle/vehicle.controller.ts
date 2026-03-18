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
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { VehicleService } from './vehicle.service';
import {
  CreateVehicleDto,
  CreateVehicleImageDto,
  CreateVehicleInspectionDto,
  CreateVehicleInsuranceDto,
  CreateVehiclePcoDocumentDto,
  ListVehiclesQueryDto,
  UpdateVehicleActiveDto,
  UpdateVehicleApprovedDto,
  UpdateVehicleDto,
  UpdateVehicleInspectionDto,
  UpdateVehicleInsuranceDto,
  UpdateVehiclePcoDocumentDto,
} from './dto';
import {
  AdminApproveVehicleSwagger,
  AdminListVehiclesSwagger,
  AdminSetVehicleActiveSwagger,
  AddVehicleImageSwagger,
  CreateVehicleInspectionSwagger,
  CreateVehicleInsuranceSwagger,
  CreateVehiclePcoDocSwagger,
  CreateVehicleSwagger,
  DeleteVehicleImageSwagger,
  DeleteVehicleInspectionSwagger,
  DeleteVehicleInsuranceSwagger,
  DeleteVehiclePcoDocSwagger,
  DeleteVehicleSwagger,
  GetVehicleSwagger,
  ListDriverVehiclesSwagger,
  UpdateVehicleInspectionSwagger,
  UpdateVehicleInsuranceSwagger,
  UpdateVehiclePcoDocSwagger,
  UpdateVehicleSwagger,
} from './decorators/vehicle-swagger.decorator';

@ApiTags('Vehicles')
@Controller()
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  // -----------------------
  // Driver-scoped vehicles
  // -----------------------
  @Post('driver/:driverId/vehicles')
  @CreateVehicleSwagger()
  @Roles('DRIVER', 'ADMIN')
  @ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' })
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
  @ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' })
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
  @ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' })
  @ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' })
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

  // -----------------------
  // Images
  // -----------------------
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
    return this.vehicleService.deleteImage(
      driverId,
      vehicleId,
      imageId,
      req.user,
    );
  }

  // -----------------------
  // Inspections
  // -----------------------
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

  // -----------------------
  // Insurance
  // -----------------------
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

  // -----------------------
  // PCO documents
  // -----------------------
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
    return this.vehicleService.deletePcoDoc(
      driverId,
      vehicleId,
      pcoDocId,
      req.user,
    );
  }

  // -----------------------
  // Admin management
  // -----------------------
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

