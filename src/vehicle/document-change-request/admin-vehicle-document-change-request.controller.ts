import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import {
  AdminQueryVehicleDocumentChangeRequestsDto,
  AdminReviewVehicleDocumentChangeRequestDto,
} from './dto';
import { VehicleDocumentChangeRequestService } from './vehicle-document-change-request.service';

@ApiTags('Admin Vehicle Document Change Requests')
@ApiBearerAuth()
@Controller('admin')
export class AdminVehicleDocumentChangeRequestController {
  constructor(
    private readonly changeRequestService: VehicleDocumentChangeRequestService,
  ) {}

  @Get('drivers/:driverId/vehicle-document-change-requests')
  @Roles('ADMIN')
  listForDriver(
    @Param('driverId') driverId: string,
    @Query() query: AdminQueryVehicleDocumentChangeRequestsDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminListForDriver(driverId, query, req.user);
  }

  @Get('vehicles/:vehicleId/document-change-requests')
  @Roles('ADMIN')
  @ApiParam({ name: 'vehicleId', type: String })
  listForVehicle(
    @Param('vehicleId') vehicleId: string,
    @Query() query: AdminQueryVehicleDocumentChangeRequestsDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminListForVehicle(vehicleId, query, req.user);
  }

  @Get('vehicle-document-change-requests/:requestId')
  @Roles('ADMIN')
  findOne(
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminFindOne(requestId, req.user);
  }

  @Patch('vehicle-document-change-requests/:requestId/review')
  @Roles('ADMIN')
  review(
    @Param('requestId') requestId: string,
    @Body() dto: AdminReviewVehicleDocumentChangeRequestDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminReview(requestId, dto, req.user);
  }
}
