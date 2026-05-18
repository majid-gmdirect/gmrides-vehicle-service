import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitDocumentOnlyChangeRequestDto {
  @ApiPropertyOptional({
    description: 'Updated document payload (Upload Service)',
    example: { id: 'file-id', url: 'https://storage.example.com/doc.pdf' },
  })
  @IsOptional()
  @IsObject()
  document?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Optional note for the reviewer' })
  @IsOptional()
  @IsString()
  driver_note?: string;
}
