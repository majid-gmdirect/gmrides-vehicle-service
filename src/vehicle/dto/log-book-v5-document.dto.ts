import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogBookV5DocumentDto {
  @ApiPropertyOptional({
    description: 'File identifier from the upload service',
    example: 'f8c3c8c4-6b2a-4c1e-9d0a-1b2c3d4e5f60',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    description: 'Public URL of the uploaded log book V5 file',
    example: 'https://storage.example.com/bucket/log-book-v5.pdf',
  })
  @IsString()
  url: string;
}
