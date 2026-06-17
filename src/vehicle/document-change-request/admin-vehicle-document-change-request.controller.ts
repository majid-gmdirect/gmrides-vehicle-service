import { Body, Controller, Delete, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VehicleDocumentChangeRequestStatus, VehicleDocumentKind } from '@prisma/client';
import { Roles } from '../../auth/roles.decorator';
import {
  AdminListAllVehicleDocumentChangeRequestsDto,
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

  @Get('vehicle-document-change-requests')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: list all vehicle document change requests (paginated summary)',
    description:
      'Returns lightweight rows for admin inbox. Use GET /admin/vehicle-document-change-requests/:requestId for full payload and review details.',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: VehicleDocumentChangeRequestStatus })
  @ApiQuery({ name: 'targetType', required: false, enum: VehicleDocumentKind })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'orderBy', required: false, enum: ['asc', 'desc'] })
  @ApiOkResponse({ description: 'Paginated vehicle document change request summaries' })
  listAll(
    @Query() query: AdminListAllVehicleDocumentChangeRequestsDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminListAll(query, req.user);
  }

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

  @Delete('vehicle-document-change-requests/:requestId')
  @Roles('ADMIN')
  @ApiParam({ name: 'requestId', type: String })
  remove(
    @Param('requestId') requestId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.changeRequestService.adminRemove(requestId, req.user);
  }
}
