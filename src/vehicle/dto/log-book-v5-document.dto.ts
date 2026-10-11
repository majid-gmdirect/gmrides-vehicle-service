import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * A file reference from upload-service. `id` is what counts: the service
 * checks it with upload-service and stores upload-service's url (or no url
 * for a private file), never the url sent here.
 */
export class LogBookV5DocumentDto {
  @ApiPropertyOptional({
    description:
      'Upload id from upload-service. Required for a new file; an unchanged stored reference may be sent back as it is.',
    example: 'f8c3c8c4-6b2a-4c1e-9d0a-1b2c3d4e5f60',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({
    description:
      'Public URL of the file. Ignored when `id` is sent; absent for a private file.',
    example: 'https://storage.example.com/bucket/log-book-v5.pdf',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    description:
      'true for a file in the private bucket (no url; read it through GET /api/uploads/:id/private-url).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
