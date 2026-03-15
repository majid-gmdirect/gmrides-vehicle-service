import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class UserRoleResponseDto {
  @ApiProperty()
  @Expose()
  role: string;
}
