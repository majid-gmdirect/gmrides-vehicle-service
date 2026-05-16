import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreatePermissionLetterDto, UpdatePermissionLetterDto } from '../dto';
import {
  CreatePermissionLetterSwagger,
  DeletePermissionLetterSwagger,
  GetPermissionLetterSwagger,
  ListPermissionLettersSwagger,
  UpdatePermissionLetterSwagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Vehicle Permission Letters')
@Controller()
export class VehiclePermissionLettersController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('driver/:driverId/vehicles/:vehicleId/permission-letters')
  @Roles('DRIVER', 'ADMIN')
  @ListPermissionLettersSwagger()
  list(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.listPermissionLetters(driverId, vehicleId, req.user);
  }

  @Get('driver/:driverId/vehicles/:vehicleId/permission-letters/:permissionLetterId')
  @Roles('DRIVER', 'ADMIN')
  @GetPermissionLetterSwagger()
  getOne(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('permissionLetterId') permissionLetterId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.getPermissionLetter(
      driverId,
      vehicleId,
      permissionLetterId,
      req.user,
    );
  }

  @Post('driver/:driverId/vehicles/:vehicleId/permission-letters')
  @Roles('DRIVER', 'ADMIN')
  @CreatePermissionLetterSwagger()
  create(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreatePermissionLetterDto,
  ) {
    return this.vehicleService.createPermissionLetter(driverId, vehicleId, dto, req.user);
  }

  @Patch('driver/:driverId/vehicles/:vehicleId/permission-letters/:permissionLetterId')
  @Roles('DRIVER', 'ADMIN')
  @UpdatePermissionLetterSwagger()
  update(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('permissionLetterId') permissionLetterId: string,
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: UpdatePermissionLetterDto,
  ) {
    return this.vehicleService.updatePermissionLetter(
      driverId,
      vehicleId,
      permissionLetterId,
      dto,
      req.user,
    );
  }

  @Delete('driver/:driverId/vehicles/:vehicleId/permission-letters/:permissionLetterId')
  @Roles('DRIVER', 'ADMIN')
  @DeletePermissionLetterSwagger()
  remove(
    @Param('driverId') driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('permissionLetterId') permissionLetterId: string,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.deletePermissionLetter(
      driverId,
      vehicleId,
      permissionLetterId,
      req.user,
    );
  }
}

