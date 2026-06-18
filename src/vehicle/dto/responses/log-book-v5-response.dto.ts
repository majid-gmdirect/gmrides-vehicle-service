import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DocumentStatus,
  VehicleDocumentChangeRequestStatus,
} from '@prisma/client';
import { PublicFileRefResponseDto } from '../../../common/dto/public-file-ref-response.dto';

export class PendingVehicleDocumentChangeRequestDto {
  @ApiProperty({
    description: 'Change request ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    enum: VehicleDocumentChangeRequestStatus,
    description: 'Change request status',
    example: VehicleDocumentChangeRequestStatus.PENDING_REVIEW,
  })
  status: VehicleDocumentChangeRequestStatus;

  @ApiProperty({
    description: 'When the change request was submitted (ISO 8601)',
    example: '2026-03-15T10:00:00.000Z',
  })
  createdAt: string;
}

export class LogBookV5ResponseDto {
  @ApiProperty({
    description: 'Log book V5 record ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Vehicle ID this document belongs to',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  vehicleId: string;

  @ApiProperty({
    description: 'Uploaded log book V5 file reference',
    type: () => PublicFileRefResponseDto,
    example: {
      id: 'f8c3c8c4-6b2a-4c1e-9d0a-1b2c3d4e5f60',
      url: 'https://storage.example.com/bucket/log-book-v5.pdf',
    },
  })
  document: PublicFileRefResponseDto;

  @ApiProperty({
    enum: DocumentStatus,
    description: 'Admin review status for the document',
    example: DocumentStatus.PENDING,
  })
  status: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Rejection reason when status is REJECTED',
    example: 'Document is unreadable — please upload a clearer scan.',
    nullable: true,
  })
  rejectedReason?: string | null;

  @ApiProperty({
    description: 'Record creation time (ISO 8601)',
    example: '2026-03-15T10:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Record last update time (ISO 8601)',
    example: '2026-03-15T10:00:00.000Z',
  })
  updatedAt: string;

  @ApiPropertyOptional({
    description:
      'Present on driver-facing list/get/update responses when a document change request is awaiting admin review. Omitted on admin routes and on create.',
    type: () => PendingVehicleDocumentChangeRequestDto,
    nullable: true,
  })
  pendingChangeRequest?: PendingVehicleDocumentChangeRequestDto | null;
}

export class LogBookV5SuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: () => LogBookV5ResponseDto })
  data: LogBookV5ResponseDto;

  @ApiProperty({ example: 'Log book V5 retrieved successfully' })
  message: string;
}

export class LogBookV5ListSuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: () => LogBookV5ResponseDto, isArray: true })
  data: LogBookV5ResponseDto[];

  @ApiProperty({ example: 'Log book V5 documents retrieved successfully' })
  message: string;
}
