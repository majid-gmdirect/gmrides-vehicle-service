import {
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AvatarDto } from './responses/avatar.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'First name of the user', example: 'John' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Last name of the user', example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Bio (Description about the user)' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Phone number in international E.164 format',
    example: '+442071838750',
  })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: 'Phone number must be a valid international phone number',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Phone number (alias for phone) in international E.164 format',
    example: '+1234567890',
  })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: 'Phone number must be a valid international phone number',
  })
  phone_number?: string;

  @ApiPropertyOptional({ type: AvatarDto, required: false })
  @IsOptional()
  @Type(() => AvatarDto)
  avatar?: AvatarDto;
}
