import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class CreateLogBookV5Dto {
  @ApiProperty({
    description: 'Log book V5 document payload (Upload Service)',
    example: { id: 'file-id', url: 'https://storage.example.com/log-book-v5.pdf' },
  })
  @IsObject()
  document: Record<string, unknown>;
}
