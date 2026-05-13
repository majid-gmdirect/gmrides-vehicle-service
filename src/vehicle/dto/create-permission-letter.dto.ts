import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CreatePermissionLetterDto {
  @ApiPropertyOptional({
    description: 'Permission letter document payload (Upload Service)',
    example: { id: 'file-id', url: 'https://storage.example.com/permission-letter.pdf' },
  })
  @IsOptional()
  @IsObject()
  document?: Record<string, any>;
}

