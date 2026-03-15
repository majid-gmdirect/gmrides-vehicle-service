import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AvatarDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  url: string;

  @ApiProperty()
  @Expose()
  medium: string;

  @ApiProperty()
  @Expose()
  thumbnail: string;
}
