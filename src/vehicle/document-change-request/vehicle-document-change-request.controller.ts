import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { VehicleDocumentKind } from '@prisma/client';
import { Roles } from '../../auth/roles.decorator';
import { VehicleDocumentChangeRequestService } from './vehicle-document-change-request.service';
import {
  SubmitDocumentOnlyChangeRequestDto,
  SubmitVehicleInspectionChangeRequestDto,
  SubmitVehicleInsuranceChangeRequestDto,
  SubmitVehiclePcoChangeRequestDto,
} from './dto';

@ApiTags('Vehicle Document Change Requests')
@Controller()
export class VehicleDocumentChangeRequestController {
  constructor(
    private readonly changeRequestService: VehicleDocumentChangeRequestService,
  ) {}

  @Post('driver/:driverId/vehicles/:vehicleId/inspections/:inspectionId/change-requests')
  @Roles('DRIVER')
  @ApiParam({ name: 'driverId', type: String })
  @ApiParam({ name: 'vehicleId', type: String })
  @ApiParam({ name: 'inspectionId', type: String })
  submitInspection(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('inspectionId') inspectionId: string,
    @Body() dto: SubmitVehicleInspectionChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.submitInspection(
      driverId,
      vehicleId,
      inspectionId,
      dto,
      req.user,
    );
  }

  @Get('driver/:driverId/vehicles/:vehicleId/inspections/:inspectionId/change-requests')
  @Roles('DRIVER', 'ADMIN')
  listInspection(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('inspectionId') inspectionId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.listForDocument(
      driverId,
      vehicleId,
      VehicleDocumentKind.INSPECTION,
      inspectionId,
      req.user,
    );
  }

  @Post('driver/:driverId/vehicles/:vehicleId/insurances/:insuranceId/change-requests')
  @Roles('DRIVER')
  submitInsurance(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('insuranceId') insuranceId: string,
    @Body() dto: SubmitVehicleInsuranceChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.submitInsurance(
      driverId,
      vehicleId,
      insuranceId,
      dto,
      req.user,
    );
  }

  @Get('driver/:driverId/vehicles/:vehicleId/insurances/:insuranceId/change-requests')
  @Roles('DRIVER', 'ADMIN')
  listInsurance(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('insuranceId') insuranceId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.listForDocument(
      driverId,
      vehicleId,
      VehicleDocumentKind.INSURANCE,
      insuranceId,
      req.user,
    );
  }

  @Post('driver/:driverId/vehicles/:vehicleId/pco-docs/:pcoDocId/change-requests')
  @Roles('DRIVER')
  submitPcoDoc(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('pcoDocId') pcoDocId: string,
    @Body() dto: SubmitVehiclePcoChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.submitPcoDoc(
      driverId,
      vehicleId,
      pcoDocId,
      dto,
      req.user,
    );
  }

  @Get('driver/:driverId/vehicles/:vehicleId/pco-docs/:pcoDocId/change-requests')
  @Roles('DRIVER', 'ADMIN')
  listPcoDoc(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('pcoDocId') pcoDocId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.listForDocument(
      driverId,
      vehicleId,
      VehicleDocumentKind.PCO_DOCUMENT,
      pcoDocId,
      req.user,
    );
  }

  @Post(
    'driver/:driverId/vehicles/:vehicleId/permission-letters/:permissionLetterId/change-requests',
  )
  @Roles('DRIVER')
  submitPermissionLetter(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('permissionLetterId') permissionLetterId: string,
    @Body() dto: SubmitDocumentOnlyChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.submitPermissionLetter(
      driverId,
      vehicleId,
      permissionLetterId,
      dto,
      req.user,
    );
  }

  @Get(
    'driver/:driverId/vehicles/:vehicleId/permission-letters/:permissionLetterId/change-requests',
  )
  @Roles('DRIVER', 'ADMIN')
  listPermissionLetter(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('permissionLetterId') permissionLetterId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.listForDocument(
      driverId,
      vehicleId,
      VehicleDocumentKind.PERMISSION_LETTER,
      permissionLetterId,
      req.user,
    );
  }

  @Post('driver/:driverId/vehicles/:vehicleId/schedules/:scheduleId/change-requests')
  @Roles('DRIVER')
  submitSchedule(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: SubmitDocumentOnlyChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.submitSchedule(
      driverId,
      vehicleId,
      scheduleId,
      dto,
      req.user,
    );
  }

  @Get('driver/:driverId/vehicles/:vehicleId/schedules/:scheduleId/change-requests')
  @Roles('DRIVER', 'ADMIN')
  listSchedule(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('scheduleId') scheduleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.listForDocument(
      driverId,
      vehicleId,
      VehicleDocumentKind.SCHEDULE,
      scheduleId,
      req.user,
    );
  }

  @Post('driver/:driverId/vehicles/:vehicleId/log-book-v5/:logBookV5Id/change-requests')
  @Roles('DRIVER')
  submitLogBookV5(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('logBookV5Id') logBookV5Id: string,
    @Body() dto: SubmitDocumentOnlyChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.submitLogBookV5(
      driverId,
      vehicleId,
      logBookV5Id,
      dto,
      req.user,
    );
  }

  @Get('driver/:driverId/vehicles/:vehicleId/log-book-v5/:logBookV5Id/change-requests')
  @Roles('DRIVER', 'ADMIN')
  listLogBookV5(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('logBookV5Id') logBookV5Id: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.listForDocument(
      driverId,
      vehicleId,
      VehicleDocumentKind.LOG_BOOK_V5,
      logBookV5Id,
      req.user,
    );
  }

  @Get('driver/:driverId/vehicle-document-change-requests/:requestId')
  @Roles('DRIVER', 'ADMIN')
  findOne(
    @Param('driverId') driverId: string,
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.findOne(driverId, requestId, req.user);
  }

  @Patch('driver/:driverId/vehicle-document-change-requests/:requestId/cancel')
  @Roles('DRIVER')
  cancel(
    @Param('driverId') driverId: string,
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.cancel(driverId, requestId, req.user);
  }
}
