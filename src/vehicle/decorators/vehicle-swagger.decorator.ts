import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CreateVehicleDto,
  CreateVehicleImageDto,
  CreateVehicleInspectionDto,
  CreateVehicleInsuranceDto,
  CreateVehiclePcoDocumentDto,
  ListVehiclesQueryDto,
  UpdateVehicleInspectionDto,
  UpdateVehicleInsuranceDto,
  UpdateVehiclePcoDocumentDto,
  UpdateVehicleDto,
  UpdateVehicleActiveDto,
  UpdateVehicleApprovedDto,
} from '../dto';

export function CreateVehicleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Create a vehicle for a driver' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiBody({ type: CreateVehicleDto }),
    ApiOkResponse({ description: 'Vehicle created successfully' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function ListDriverVehiclesSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'List vehicles for a driver' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiOkResponse({ description: 'Vehicles retrieved successfully' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetVehicleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a single vehicle by id (scoped to driver)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Vehicle retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function UpdateVehicleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update a vehicle (scoped to driver)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: UpdateVehicleDto }),
    ApiOkResponse({ description: 'Vehicle updated successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function DeleteVehicleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete a vehicle (scoped to driver)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Vehicle deleted successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminListVehiclesSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: list all vehicles' }),
    ApiQuery({ name: 'search', required: false, type: String }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({ name: 'orderBy', required: false, enum: ['asc', 'desc'] }),
    ApiQuery({ name: 'isApproved', required: false, type: Boolean }),
    ApiQuery({ name: 'isActive', required: false, type: Boolean }),
    ApiOkResponse({ description: 'Vehicles fetched successfully' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminApproveVehicleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: approve/unapprove a vehicle' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: UpdateVehicleApprovedDto }),
    ApiOkResponse({ description: 'Vehicle approval updated successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminSetVehicleActiveSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: set a vehicle active/inactive' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: UpdateVehicleActiveDto }),
    ApiOkResponse({ description: 'Vehicle active status updated successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AddVehicleImageSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Add an image to a vehicle' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: CreateVehicleImageDto }),
    ApiOkResponse({ description: 'Vehicle image added successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function DeleteVehicleImageSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete a vehicle image' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'imageId', type: String, description: 'Vehicle image ID' }),
    ApiOkResponse({ description: 'Vehicle image deleted successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle image not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function ListVehicleImagesSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'List vehicle images' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Vehicle images retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetVehicleImageSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a single vehicle image' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'imageId', type: String, description: 'Vehicle image ID' }),
    ApiOkResponse({ description: 'Vehicle image retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle or image not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function CreateVehicleInspectionSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Create a vehicle inspection (e.g., MOT)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: CreateVehicleInspectionDto }),
    ApiOkResponse({ description: 'Vehicle inspection created successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function UpdateVehicleInspectionSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update a vehicle inspection' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'inspectionId',
      type: String,
      description: 'Vehicle inspection ID',
    }),
    ApiBody({ type: UpdateVehicleInspectionDto }),
    ApiOkResponse({ description: 'Vehicle inspection updated successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle inspection not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function DeleteVehicleInspectionSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete a vehicle inspection' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'inspectionId',
      type: String,
      description: 'Vehicle inspection ID',
    }),
    ApiOkResponse({ description: 'Vehicle inspection deleted successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle inspection not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function ListVehicleInspectionsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'List vehicle inspections' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Vehicle inspections retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetVehicleInspectionSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a single vehicle inspection' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'inspectionId',
      type: String,
      description: 'Vehicle inspection ID',
    }),
    ApiOkResponse({ description: 'Vehicle inspection retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle or inspection not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function CreateVehicleInsuranceSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Create a vehicle insurance record' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: CreateVehicleInsuranceDto }),
    ApiOkResponse({ description: 'Vehicle insurance created successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function UpdateVehicleInsuranceSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update a vehicle insurance record' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'insuranceId',
      type: String,
      description: 'Vehicle insurance ID',
    }),
    ApiBody({ type: UpdateVehicleInsuranceDto }),
    ApiOkResponse({ description: 'Vehicle insurance updated successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle insurance not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function DeleteVehicleInsuranceSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete a vehicle insurance record' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'insuranceId',
      type: String,
      description: 'Vehicle insurance ID',
    }),
    ApiOkResponse({ description: 'Vehicle insurance deleted successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle insurance not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function ListVehicleInsurancesSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'List vehicle insurance records' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Vehicle insurances retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetVehicleInsuranceSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a single vehicle insurance record' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'insuranceId',
      type: String,
      description: 'Vehicle insurance ID',
    }),
    ApiOkResponse({ description: 'Vehicle insurance retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle or insurance not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function CreateVehiclePcoDocSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Create a vehicle PCO document record' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: CreateVehiclePcoDocumentDto }),
    ApiOkResponse({ description: 'Vehicle PCO document created successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function UpdateVehiclePcoDocSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update a vehicle PCO document record' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'pcoDocId', type: String, description: 'PCO document ID' }),
    ApiBody({ type: UpdateVehiclePcoDocumentDto }),
    ApiOkResponse({ description: 'Vehicle PCO document updated successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle PCO document not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function DeleteVehiclePcoDocSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete a vehicle PCO document record' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'pcoDocId', type: String, description: 'PCO document ID' }),
    ApiOkResponse({ description: 'Vehicle PCO document deleted successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle PCO document not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function ListVehiclePcoDocsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'List vehicle PCO documents' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Vehicle PCO documents retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetVehiclePcoDocSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a single vehicle PCO document' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'pcoDocId', type: String, description: 'PCO document ID' }),
    ApiOkResponse({ description: 'Vehicle PCO document retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle or PCO document not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export const VehicleQueryDto = ListVehiclesQueryDto;

