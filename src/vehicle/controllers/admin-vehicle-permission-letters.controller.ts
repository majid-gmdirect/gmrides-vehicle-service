import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { AdminReviewPermissionLetterDto } from '../dto';
import {
  AdminGetPermissionLetterSwagger,
  AdminListPermissionLettersSwagger,
  AdminReviewPermissionLetterSwagger,
} from '../decorators/vehicle-swagger.decorator';
import { VehicleService } from '../vehicle.service';

@ApiTags('Admin Vehicle Permission Letters')
@Controller()
export class AdminVehiclePermissionLettersController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('admin/vehicles/:vehicleId/permission-letters')
  @Roles('ADMIN')
  @AdminListPermissionLettersSwagger()
  list(@Param('vehicleId') vehicleId: string) {
    return this.vehicleService.adminListPermissionLetters(vehicleId);
  }

  @Get('admin/vehicles/:vehicleId/permission-letters/:permissionLetterId')
  @Roles('ADMIN')
  @AdminGetPermissionLetterSwagger()
  getOne(
    @Param('vehicleId') vehicleId: string,
    @Param('permissionLetterId') permissionLetterId: string,
  ) {
    return this.vehicleService.adminGetPermissionLetter(vehicleId, permissionLetterId);
  }

  @Patch('admin/vehicles/:vehicleId/permission-letters/:permissionLetterId/review')
  @Roles('ADMIN')
  @AdminReviewPermissionLetterSwagger()
  review(
    @Param('vehicleId') vehicleId: string,
    @Param('permissionLetterId') permissionLetterId: string,
    @Body() dto: AdminReviewPermissionLetterDto,
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.vehicleService.adminReviewPermissionLetter(
      vehicleId,
      permissionLetterId,
      dto,
      req.user,
    );
  }
}

