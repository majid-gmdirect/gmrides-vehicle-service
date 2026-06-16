import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';

export function DriverDocumentStatusSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get driver vehicle document statuses (DRIVER/ADMIN)',
      description:
        'Returns review status for all vehicle-linked documents (log book V5, inspections, insurance, PCO docs, permission letters, schedules) plus documentRequirements per vehicle. Permission letter and schedule are optional until requiestOptionalDocuments is true. For driver licence/PCO/contract status use GET /api/users/driver/:driverId/document-status.',
    }),
    ApiParam({
      name: 'driverId',
      type: String,
      description: 'Driver user ID',
    }),
    ApiOkResponse({ description: 'Vehicle document statuses retrieved' }),
    ApiNotFoundResponse({ description: 'Driver or vehicle data not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}
