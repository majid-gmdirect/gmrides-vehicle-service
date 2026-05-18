import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleDocumentChangeRequestStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class AdminReviewVehicleChangeRequestDto {
  @ApiProperty({
    enum: [
      VehicleDocumentChangeRequestStatus.ACCEPTED,
      VehicleDocumentChangeRequestStatus.REJECTED,
    ],
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
  })
  @ValidateIf(
    (o) => o.decision === VehicleDocumentChangeRequestStatus.REJECTED,
  )
  @IsString()
  @IsOptional()
  rejectedReason?: string;
}
