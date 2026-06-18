import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { LogBookV5DocumentDto } from './log-book-v5-document.dto';

export class CreateLogBookV5Dto {
  @ApiProperty({
    description:
      'Log book V5 file reference from the upload service. Send `id` when available plus the public `url`.',
    type: LogBookV5DocumentDto,
    example: {
      id: 'f8c3c8c4-6b2a-4c1e-9d0a-1b2c3d4e5f60',
      url: 'https://storage.example.com/bucket/log-book-v5.pdf',
    },
  })
  @ValidateNested()
  @Type(() => LogBookV5DocumentDto)
  document: LogBookV5DocumentDto;
}
