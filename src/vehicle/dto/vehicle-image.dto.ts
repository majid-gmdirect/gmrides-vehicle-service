import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

export class VehicleFileDto {
  @ApiProperty({
    description: 'Uploaded file payload (from Upload Service)',
    example: { id: 'file-id', url: 'https://storage.example.com/file.jpg' },
  })
  @IsObject()
  image: Record<string, any>;
}

export class CreateVehicleImageDto extends VehicleFileDto {
  @ApiProperty({
    description: 'Image type (front, back, interior, plate, registration, other)',
    example: 'front',
  })
  @IsString()
  type: string;
}

