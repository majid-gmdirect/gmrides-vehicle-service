import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalRoute } from '../../auth/internal.decorator';
import { VehicleDocumentChangeRequestService } from '../document-change-request/vehicle-document-change-request.service';
import { VehicleChangeRequestService } from '../vehicle-change-request/vehicle-change-request.service';
import { InternalListChangeRequestSummariesQueryDto } from '../dto/internal-list-change-request-summaries-query.dto';

@ApiExcludeController()
@Controller('internal/change-requests')
export class InternalChangeRequestsController {
  constructor(
    private readonly documentChangeRequestService: VehicleDocumentChangeRequestService,
    private readonly vehicleChangeRequestService: VehicleChangeRequestService,
  ) {}

  @Get('summaries')
  @InternalRoute()
  listSummaries(@Query() query: InternalListChangeRequestSummariesQueryDto) {
    return Promise.all([
      this.documentChangeRequestService.internalListAllSummaries(query),
      this.vehicleChangeRequestService.internalListAllSummaries(query),
    ]).then(([vehicleDocuments, vehicleProfile]) => ({
      success: true,
      data: {
        vehicleDocuments,
        vehicleProfile,
      },
      message: 'Vehicle change request summaries retrieved successfully',
    }));
  }
}
