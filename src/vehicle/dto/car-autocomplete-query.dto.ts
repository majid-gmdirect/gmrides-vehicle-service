import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CarAutocompleteQueryDto {
  @ApiPropertyOptional({
    description: 'Search text (prefix/partial)',
    example: 'to',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: 'Max suggestions to return',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class CarModelAutocompleteQueryDto extends CarAutocompleteQueryDto {
  @ApiPropertyOptional({
    description: 'Optional make to narrow model suggestions',
    example: 'Toyota',
  })
  @IsOptional()
  @IsString()
  make?: string;
}

