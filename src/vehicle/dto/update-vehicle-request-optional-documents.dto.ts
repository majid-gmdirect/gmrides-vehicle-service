import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateVehicleRequestOptionalDocumentsDto {
  @ApiProperty({
    description:
      'When true, the driver is prompted to upload optional documents (permission letter and vehicle schedule).',
    example: true,
  })
  @IsBoolean()
  requiestOptionalDocuments: boolean;
}
