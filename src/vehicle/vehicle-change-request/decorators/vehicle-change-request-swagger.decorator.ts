import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import {
  AdminReviewVehicleChangeRequestDto,
  SubmitVehicleChangeRequestDto,
} from '../dto';
import {
  VehicleChangeRequestListSuccessResponseDto,
  VehicleChangeRequestSuccessResponseDto,
} from '../dto/responses/vehicle-change-request-response.dto';

export function SubmitVehicleChangeRequestSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Submit a change request for an approved vehicle profile',
      description:
        'When a vehicle is approved (isApproved), drivers cannot PATCH it directly. Submit proposed changes here (make, model, year, color, plate, isActive, legacy permission_letter / vehicle_schedule JSON). Only one PENDING_REVIEW request per vehicle is allowed.',
    }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: SubmitVehicleChangeRequestDto }),
    ApiCreatedResponse({
      description: 'Vehicle change request submitted successfully',
      type: VehicleChangeRequestSuccessResponseDto,
    }),
    ApiConflictResponse({ description: 'Pending change request already exists' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function ListVehicleChangeRequestsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'List vehicle profile change requests for a vehicle' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({
      description: 'Vehicle change requests retrieved successfully',
      type: VehicleChangeRequestListSuccessResponseDto,
    }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetVehicleChangeRequestSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a vehicle profile change request by ID' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'requestId', type: String, description: 'Change request ID' }),
    ApiOkResponse({
      description: 'Vehicle change request retrieved successfully',
      type: VehicleChangeRequestSuccessResponseDto,
    }),
    ApiNotFoundResponse({ description: 'Change request not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function CancelVehicleChangeRequestSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Cancel a pending vehicle profile change request' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'requestId', type: String, description: 'Change request ID' }),
    ApiOkResponse({
      description: 'Vehicle change request cancelled successfully',
      type: VehicleChangeRequestSuccessResponseDto,
    }),
    ApiConflictResponse({ description: 'Change request is not pending' }),
    ApiNotFoundResponse({ description: 'Change request not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminListDriverVehicleChangeRequestsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: list vehicle profile change requests for a driver' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiOkResponse({
      description: 'Vehicle change requests retrieved successfully',
      type: VehicleChangeRequestListSuccessResponseDto,
    }),
    ApiForbiddenResponse({ description: 'Admin access required' }),
  );
}

export function AdminListVehicleProfileChangeRequestsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: list vehicle profile change requests for a vehicle' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({
      description: 'Vehicle change requests retrieved successfully',
      type: VehicleChangeRequestListSuccessResponseDto,
    }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Admin access required' }),
  );
}

export function AdminGetVehicleChangeRequestSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: get a vehicle profile change request by ID' }),
    ApiParam({ name: 'requestId', type: String, description: 'Change request ID' }),
    ApiOkResponse({
      description: 'Vehicle change request retrieved successfully',
      type: VehicleChangeRequestSuccessResponseDto,
    }),
    ApiNotFoundResponse({ description: 'Change request not found' }),
    ApiForbiddenResponse({ description: 'Admin access required' }),
  );
}

export function AdminReviewVehicleChangeRequestSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Admin: approve or reject a vehicle profile change request',
      description:
        'Approving applies the proposed snapshot to the live vehicle row. Rejecting leaves the vehicle unchanged. The driver is notified by email.',
    }),
    ApiParam({ name: 'requestId', type: String, description: 'Change request ID' }),
    ApiBody({ type: AdminReviewVehicleChangeRequestDto }),
    ApiOkResponse({
      description: 'Vehicle change request reviewed successfully',
      type: VehicleChangeRequestSuccessResponseDto,
    }),
    ApiConflictResponse({ description: 'Change request is not pending review' }),
    ApiNotFoundResponse({ description: 'Change request not found' }),
    ApiForbiddenResponse({ description: 'Admin access required' }),
  );
}

export function AdminDeleteVehicleChangeRequestSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Admin: delete a completed vehicle profile change request',
      description:
        'Removes the change request record only (e.g. after ACCEPTED or REJECTED). Cannot delete PENDING_REVIEW requests.',
    }),
    ApiParam({ name: 'requestId', type: String, description: 'Change request ID' }),
    ApiOkResponse({
      description: 'Vehicle change request deleted successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { nullable: true, example: null },
          message: {
            type: 'string',
            example: 'Vehicle change request deleted successfully',
          },
        },
      },
    }),
    ApiConflictResponse({ description: 'Cannot delete a pending change request' }),
    ApiNotFoundResponse({ description: 'Change request not found' }),
    ApiForbiddenResponse({ description: 'Admin access required' }),
  );
}
