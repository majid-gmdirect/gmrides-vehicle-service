import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CreateVehicleScheduleDto {
  @ApiPropertyOptional({
    description: 'Vehicle schedule document payload (Upload Service)',
    example: { id: 'file-id', url: 'https://storage.example.com/vehicle-schedule.pdf' },
  })
  @IsOptional()
  @IsObject()
  document?: Record<string, any>;
}

