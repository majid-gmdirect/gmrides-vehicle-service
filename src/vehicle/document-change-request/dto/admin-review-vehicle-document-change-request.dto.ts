import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleDocumentChangeRequestStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class AdminReviewVehicleDocumentChangeRequestDto {
  @ApiProperty({
    enum: [
      VehicleDocumentChangeRequestStatus.ACCEPTED,
      VehicleDocumentChangeRequestStatus.REJECTED,
    ],
    description:
      'ACCEPTED applies the proposed snapshot to the live document; REJECTED discards it',
    example: VehicleDocumentChangeRequestStatus.ACCEPTED,
  })
  @IsIn([
    VehicleDocumentChangeRequestStatus.ACCEPTED,
    VehicleDocumentChangeRequestStatus.REJECTED,
  ])
  decision:
    | typeof VehicleDocumentChangeRequestStatus.ACCEPTED
    | typeof VehicleDocumentChangeRequestStatus.REJECTED;

  @ApiPropertyOptional({
    description: 'Required when decision is REJECTED',
    example: 'Expiry date on the new document is not readable.',
  })
  @ValidateIf(
    (o) => o.decision === VehicleDocumentChangeRequestStatus.REJECTED,
  )
  @IsString()
  @IsOptional()
  rejectedReason?: string;
}
