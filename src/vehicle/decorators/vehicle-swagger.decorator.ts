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
  CreatePermissionLetterDto,
  AdminReviewPermissionLetterDto,
  CreateVehicleScheduleDto,
  AdminReviewVehicleScheduleDto,
  ListVehiclesQueryDto,
  UpdateVehicleInspectionDto,
  UpdateVehicleInsuranceDto,
  UpdateVehiclePcoDocumentDto,
  UpdatePermissionLetterDto,
  UpdateVehicleScheduleDto,
  UpdateVehicleDto,
  UpdateVehicleActiveDto,
  UpdateVehicleApprovedDto,
  UpdateVehicleRequestOptionalDocumentsDto,
  CreateLogBookV5Dto,
  UpdateLogBookV5Dto,
  AdminReviewLogBookV5Dto,
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
    ApiOperation({
      summary: 'Admin: list all vehicles',
      description:
        'Each vehicle includes images, log book V5, inspections, insurances, PCO documents, permission letters, vehicle schedules, requiestOptionalDocuments, and driver summary.',
    }),
    ApiQuery({ name: 'search', required: false, type: String }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({ name: 'orderBy', required: false, enum: ['asc', 'desc'] }),
    ApiQuery({ name: 'isApproved', required: false, type: Boolean }),
    ApiQuery({ name: 'isActive', required: false, type: Boolean }),
    ApiQuery({
      name: 'isExpired',
      required: false,
      type: Boolean,
      description:
        'Filter by expired accepted vehicle documents (inspection, insurance, PCO)',
    }),
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

export function AdminRequestOptionalDocumentsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Admin: request optional documents from driver',
      description:
        'Sets requiestOptionalDocuments on the vehicle. Cleared automatically when both permission letter and vehicle schedule are accepted.',
    }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: UpdateVehicleRequestOptionalDocumentsDto }),
    ApiOkResponse({
      description: 'Vehicle optional document request updated successfully',
    }),
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
    ApiOperation({
      summary: 'Update a vehicle inspection',
      description:
        'Drivers may update document fields; updating a rejected record resets status to PENDING for re-review. Only admins may set status/rejectedReason; when status becomes REJECTED, the driver is emailed.',
    }),
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
    ApiOperation({
      summary: 'Update a vehicle insurance record',
      description:
        'Drivers may update document fields; updating a rejected record resets status to PENDING for re-review. Only admins may set status/rejectedReason; when status becomes REJECTED, the driver is emailed.',
    }),
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
    ApiOperation({
      summary: 'Update a vehicle PCO document record',
      description:
        'Drivers may update document fields; updating a rejected record resets status to PENDING for re-review. Only admins may set status/rejectedReason; when status becomes REJECTED, the driver is emailed.',
    }),
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

// -----------------------
// Permission letters
// -----------------------
export function ListPermissionLettersSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'List permission letters for a vehicle (DRIVER/ADMIN)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Permission letters retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetPermissionLetterSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a permission letter (DRIVER/ADMIN)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'permissionLetterId',
      type: String,
      description: 'Permission letter ID',
    }),
    ApiOkResponse({ description: 'Permission letter retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Permission letter not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function CreatePermissionLetterSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create a permission letter (DRIVER/ADMIN)',
      description:
        'Upload document payload. Review status/rejectedReason is set via admin review endpoints.',
    }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: CreatePermissionLetterDto }),
    ApiOkResponse({ description: 'Permission letter created successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function UpdatePermissionLetterSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update a permission letter (DRIVER/ADMIN)',
      description:
        'Update document fields; uploading a new file on a rejected record resets status to PENDING. Admin review uses separate review endpoints.',
    }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'permissionLetterId',
      type: String,
      description: 'Permission letter ID',
    }),
    ApiBody({ type: UpdatePermissionLetterDto }),
    ApiOkResponse({ description: 'Permission letter updated successfully' }),
    ApiNotFoundResponse({ description: 'Permission letter not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function DeletePermissionLetterSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete a permission letter (DRIVER/ADMIN)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'permissionLetterId',
      type: String,
      description: 'Permission letter ID',
    }),
    ApiOkResponse({ description: 'Permission letter deleted successfully' }),
    ApiNotFoundResponse({ description: 'Permission letter not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminListPermissionLettersSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: list vehicle permission letters' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Permission letters retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminGetPermissionLetterSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: get vehicle permission letter' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'permissionLetterId',
      type: String,
      description: 'Permission letter ID',
    }),
    ApiOkResponse({ description: 'Permission letter retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Permission letter not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminReviewPermissionLetterSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Admin: review a permission letter (set status / rejectedReason)',
    }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({
      name: 'permissionLetterId',
      type: String,
      description: 'Permission letter ID',
    }),
    ApiBody({ type: AdminReviewPermissionLetterDto }),
    ApiOkResponse({ description: 'Permission letter reviewed successfully' }),
    ApiNotFoundResponse({ description: 'Permission letter not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

// -----------------------
// Log book V5
// -----------------------
export function ListLogBookV5Swagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'List log book V5 documents for a vehicle (DRIVER/ADMIN)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Log book V5 documents retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetLogBookV5Swagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a log book V5 document (DRIVER/ADMIN)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'logBookV5Id', type: String, description: 'Log book V5 ID' }),
    ApiOkResponse({ description: 'Log book V5 retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Log book V5 not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function CreateLogBookV5Swagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create a log book V5 document (DRIVER/ADMIN)',
      description:
        'Upload document payload. Review status/rejectedReason is set via admin review endpoints.',
    }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: CreateLogBookV5Dto }),
    ApiOkResponse({ description: 'Log book V5 created successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function UpdateLogBookV5Swagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update a log book V5 document (DRIVER/ADMIN)',
      description:
        'Update document fields; uploading a new file on a rejected record resets status to PENDING. Admin review uses separate review endpoints.',
    }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'logBookV5Id', type: String, description: 'Log book V5 ID' }),
    ApiBody({ type: UpdateLogBookV5Dto }),
    ApiOkResponse({ description: 'Log book V5 updated successfully' }),
    ApiNotFoundResponse({ description: 'Log book V5 not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function DeleteLogBookV5Swagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete a log book V5 document (DRIVER/ADMIN)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'logBookV5Id', type: String, description: 'Log book V5 ID' }),
    ApiOkResponse({ description: 'Log book V5 deleted successfully' }),
    ApiNotFoundResponse({ description: 'Log book V5 not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminListLogBookV5Swagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: list log book V5 documents' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Log book V5 documents retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminGetLogBookV5Swagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: get log book V5 document' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'logBookV5Id', type: String, description: 'Log book V5 ID' }),
    ApiOkResponse({ description: 'Log book V5 retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Log book V5 not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminReviewLogBookV5Swagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Admin: review a log book V5 document (set status / rejectedReason)',
    }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'logBookV5Id', type: String, description: 'Log book V5 ID' }),
    ApiBody({ type: AdminReviewLogBookV5Dto }),
    ApiOkResponse({ description: 'Log book V5 reviewed successfully' }),
    ApiNotFoundResponse({ description: 'Log book V5 not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

// -----------------------
// Vehicle schedules
// -----------------------
export function ListVehicleSchedulesSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'List vehicle schedules (DRIVER/ADMIN)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Vehicle schedules retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetVehicleScheduleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a vehicle schedule (DRIVER/ADMIN)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'scheduleId', type: String, description: 'Schedule ID' }),
    ApiOkResponse({ description: 'Vehicle schedule retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle schedule not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function CreateVehicleScheduleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create a vehicle schedule (DRIVER/ADMIN)',
      description:
        'Upload document payload. Review status/rejectedReason is set via admin review endpoints.',
    }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiBody({ type: CreateVehicleScheduleDto }),
    ApiOkResponse({ description: 'Vehicle schedule created successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function UpdateVehicleScheduleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update a vehicle schedule (DRIVER/ADMIN)',
      description:
        'Update document fields; uploading a new file on a rejected record resets status to PENDING. Admin review uses separate review endpoints.',
    }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'scheduleId', type: String, description: 'Schedule ID' }),
    ApiBody({ type: UpdateVehicleScheduleDto }),
    ApiOkResponse({ description: 'Vehicle schedule updated successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle schedule not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function DeleteVehicleScheduleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete a vehicle schedule (DRIVER/ADMIN)' }),
    ApiParam({ name: 'driverId', type: String, description: 'Driver user ID' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'scheduleId', type: String, description: 'Schedule ID' }),
    ApiOkResponse({ description: 'Vehicle schedule deleted successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle schedule not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminListVehicleSchedulesSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: list vehicle schedules' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiOkResponse({ description: 'Vehicle schedules retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminGetVehicleScheduleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Admin: get vehicle schedule' }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'scheduleId', type: String, description: 'Schedule ID' }),
    ApiOkResponse({ description: 'Vehicle schedule retrieved successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle schedule not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function AdminReviewVehicleScheduleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Admin: review a vehicle schedule (set status / rejectedReason)',
    }),
    ApiParam({ name: 'vehicleId', type: String, description: 'Vehicle ID' }),
    ApiParam({ name: 'scheduleId', type: String, description: 'Schedule ID' }),
    ApiBody({ type: AdminReviewVehicleScheduleDto }),
    ApiOkResponse({ description: 'Vehicle schedule reviewed successfully' }),
    ApiNotFoundResponse({ description: 'Vehicle schedule not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export const VehicleQueryDto = ListVehiclesQueryDto;

