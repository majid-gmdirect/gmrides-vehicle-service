import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileReviewDto {
  @ApiProperty({
    description: 'Whether this specific file was accepted by admin review',
    example: false,
  })
  status: boolean;

  @ApiPropertyOptional({
    description: 'Reason when status is false',
    example: 'The image is not clear',
  })
  reason?: string;
}

/** File reference returned to clients (id when available + url). */
export class PublicFileRefResponseDto {
  @ApiPropertyOptional({
    description: 'File identifier from the upload service',
    example: 'f8c3c8c4-6b2a-4c1e-9d0a-1b2c3d4e5f60',
  })
  id?: string;

  @ApiProperty({
    description: 'URL for the file',
    example: 'https://storage.example.com/bucket/log-book-v5.pdf',
  })
  url: string;

  @ApiPropertyOptional({
    description: 'Per-file review metadata (present when admin flags a specific upload)',
    type: () => FileReviewDto,
  })
  review?: FileReviewDto;
}
