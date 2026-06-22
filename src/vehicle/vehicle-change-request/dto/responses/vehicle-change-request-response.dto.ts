import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleDocumentChangeRequestStatus } from '@prisma/client';
import { PublicFileRefResponseDto } from '../../../../common/dto/public-file-ref-response.dto';

export class VehicleChangePayloadResponseDto {
  @ApiProperty({ example: 'Toyota' })
  make: string;

  @ApiProperty({ example: 'Prius' })
  model: string;

  @ApiProperty({ example: 2020 })
  year: number;

  @ApiPropertyOptional({ example: 'Black', nullable: true })
  color?: string | null;

  @ApiProperty({ example: 'AB12CDE' })
  plateNumber: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: () => PublicFileRefResponseDto, nullable: true })
  permission_letter?: PublicFileRefResponseDto | null;

  @ApiPropertyOptional({ type: () => PublicFileRefResponseDto, nullable: true })
  vehicle_schedule?: PublicFileRefResponseDto | null;
}

export class VehicleChangeRequestDriverSummaryDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id?: string;

  @ApiPropertyOptional({ example: 'John' })
  firstName?: string | null;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName?: string | null;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: 'John Doe' })
  displayName?: string;
}

export class VehicleChangeRequestVehicleSummaryDto {
  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440001' })
  id: string;

  @ApiProperty({ example: 'Toyota' })
  make: string;

  @ApiProperty({ example: 'Prius' })
  model: string;

  @ApiProperty({ example: 'AB12CDE' })
  plateNumber: string;

  @ApiProperty({ example: 'Toyota Prius (AB12CDE)' })
  displayName: string;
}

export class VehicleChangeRequestResponseDto {
  @ApiProperty({ example: '770e8400-e29b-41d4-a716-446655440002' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  driverId: string;

  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440001' })
  vehicleId: string;

  @ApiProperty({ enum: VehicleDocumentChangeRequestStatus })
  status: VehicleDocumentChangeRequestStatus;

  @ApiProperty({
    description: 'Proposed vehicle snapshot (editable driver fields only)',
    type: () => VehicleChangePayloadResponseDto,
  })
  payload: VehicleChangePayloadResponseDto;

  @ApiPropertyOptional({ example: 'Updated plate after transfer' })
  driver_note?: string | null;

  @ApiPropertyOptional({ example: 'Plate number format is invalid' })
  rejected_reason?: string | null;

  @ApiPropertyOptional({ example: '880e8400-e29b-41d4-a716-446655440003' })
  reviewed_by_id?: string | null;

  @ApiPropertyOptional({ example: '2026-03-15T10:00:00.000Z' })
  reviewed_at?: string | null;

  @ApiProperty({ example: '2026-03-15T09:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-03-15T10:00:00.000Z' })
  updatedAt: string;
}

export class VehicleChangeRequestSummaryResponseDto {
  @ApiProperty({ example: '770e8400-e29b-41d4-a716-446655440002' })
  id: string;

  @ApiProperty({ enum: VehicleDocumentChangeRequestStatus })
  status: VehicleDocumentChangeRequestStatus;

  @ApiProperty({ example: 'vehicle profile' })
  targetTypeLabel: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  driverId: string;

  @ApiPropertyOptional({ type: () => VehicleChangeRequestDriverSummaryDto, nullable: true })
  driver?: VehicleChangeRequestDriverSummaryDto | null;

  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440001' })
  vehicleId: string;

  @ApiProperty({ type: () => VehicleChangeRequestVehicleSummaryDto })
  vehicle: VehicleChangeRequestVehicleSummaryDto;

  @ApiPropertyOptional({ example: 'Updated plate after transfer' })
  driver_note?: string | null;

  @ApiProperty({ example: '2026-03-15T09:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-03-15T10:00:00.000Z' })
  updatedAt: string;
}

export class VehicleChangeRequestSuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: () => VehicleChangeRequestResponseDto })
  data: VehicleChangeRequestResponseDto;

  @ApiProperty({ example: 'Vehicle change request submitted successfully' })
  message: string;
}

export class VehicleChangeRequestListSuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: () => VehicleChangeRequestResponseDto, isArray: true })
  data: VehicleChangeRequestResponseDto[];

  @ApiProperty({ example: 'Vehicle change requests retrieved successfully' })
  message: string;
}

export class VehicleChangeRequestSummaryListSuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: () => VehicleChangeRequestSummaryResponseDto, isArray: true })
  data: VehicleChangeRequestSummaryResponseDto[];

  @ApiProperty({
    example: { total: 1, page: 1, limit: 10 },
  })
  pagination: { total: number; page: number; limit: number };

  @ApiProperty({ example: 'Vehicle change requests retrieved successfully' })
  message: string;
}
