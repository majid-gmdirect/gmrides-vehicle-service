import { IsEnum, IsEmail, IsNotEmpty, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../role.dto';

export class CreateUserByServiceDto {
  @ApiProperty({
    description: 'User Id',
    required: true,
    format: 'string',
  })
  @IsNotEmpty({ message: 'userId is required' })
  userId: string;

  @ApiProperty({
    description: 'Role is DRIVER | CUSTOMER',
    required: true,
    format: 'string',
  })
  @IsEnum(UserRole, { message: 'Role must be CUSTOMER or DRIVER' })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;

  @ApiProperty({
    description: "The user's email address",
    required: true,
    format: 'email',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'Frist name of the user',
    required: true,
    format: 'string',
  })
  @IsNotEmpty({ message: 'Frist Name is Required' })
  first_name: string;

  @ApiProperty({
    description: 'Last name of the user',
    required: true,
    format: 'string',
  })
  @IsNotEmpty({ message: 'Last name is required' })
  last_name: string;

  @ApiProperty({
    description: 'Phone number in international E.164 format',
    example: '+442071838750',
    required: true,
    format: 'string',
  })
  @IsPhoneNumber(undefined, {
    message: 'Phone number must be a valid international phone number',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;
}
