// find-pros.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class FindProsDto {
  @ApiProperty({
    type: [String],
    description: 'List of pro IDs to fetch full objects',
    example: ['pro1', 'pro2', 'pro3'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  proIds: string[];
}
