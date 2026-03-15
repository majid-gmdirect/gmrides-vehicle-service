import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { AvatarDto } from './avatar.dto';

export class UserResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  firstName: string;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty({ type: AvatarDto, required: false })
  @IsOptional()
  @Expose()
  @Type(() => AvatarDto)
  avatar?: AvatarDto;

  @ApiProperty()
  @Expose()
  role: string;

  @ApiProperty()
  @Expose()
  createdAt: Date;
}
