import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import {
  UserResponseDto,
  PaginatedUsersResponseDto,
  UpdateUserDto,
  UserRoleResponseDto,
  UpdateUserRoleDto,
  UserRole,
} from '../dto';

export function FindAllUsersSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get all users with optional search, pagination, and ordering',
    }),
    ApiQuery({
      name: 'search',
      required: false,
      description: 'Search by email or name',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      description: 'Page number',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'Results per page',
      example: 10,
    }),
    ApiQuery({
      name: 'orderBy',
      required: false,
      enum: ['asc', 'desc'],
      description: 'Order by creation date',
      example: 'desc',
    }),
    ApiOkResponse({
      description: 'Paginated list of users',
      type: PaginatedUsersResponseDto,
    }),
    ApiQuery({
      name: 'role',
      required: false,
      enum: UserRole,
      description: 'Filter by user role',
    }),
  );
}
export function FindUserSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get user by ID (admin or owner only)' }),
    ApiOkResponse({
      description: 'User retrieved successfully',
      type: UserResponseDto,
    }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiNotFoundResponse({ description: 'User not found' }),
  );
}
export function UpdateUserSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update user (admin or owner only)' }),
    ApiBody({ type: UpdateUserDto }),
    ApiOkResponse({
      description: 'User updated successfully',
      type: UserResponseDto,
    }),
    ApiNotFoundResponse({ description: 'User not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}
export function DeleteUserSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete user (admin or owner only)' }),
    ApiOkResponse({ description: 'User deleted successfully' }),
    ApiNotFoundResponse({ description: 'User not found' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}
export const UpdateUserRoleSwagger = () => {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update user role (Admin only)' }),
    ApiBody({ type: UpdateUserRoleDto }),
    ApiOkResponse({
      description: 'User role updated successfully',
      type: UserRoleResponseDto,
    }),
    ApiResponse({ status: 200, description: 'Role updated successfully' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'User not found' }),
  );
};

export function FindProsSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get recommended professionals by service',
      description:
        'Fetch recommended professionals based on filters like proIds, serviceCategoryId, and location.',
    }),
    ApiOkResponse({
      type: [UserResponseDto],
      description: 'List of recommended professionals',
    }),
  );
}
