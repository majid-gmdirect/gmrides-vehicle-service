import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Delete,
  Req,
  Post,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import {
  CreateUserByServiceDto,
  UpdateUserDto,
  FindUsersQueryDto,
  UpdateUserRoleDto,
  UserRole,
} from './dto';
import { Roles } from '../auth/roles.decorator';
import {
  DeleteUserSwagger,
  FindAllUsersSwagger,
  FindUserSwagger,
  UpdateUserSwagger,
  UpdateUserRoleSwagger,
  FindProsSwagger,
} from './decorators/user-swagger.decorator';
import { updateUserEmailByServiceDto } from './dto/service/update-email.dto';

import { FindProsDto } from './dto/find-pros.dto';
import { Public } from 'src/auth/public.decorator';
import { InternalRoute } from 'src/auth/internal.decorator';

@ApiTags('Users')
@Controller('main')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ✅ Create Profile after Auth registration
  @Post('/internal/create-user-profile')
  @ApiExcludeEndpoint()
  @InternalRoute()
  async createProfile(@Body() dto: CreateUserByServiceDto) {
    console.log('[USER-SERVICE] Received create profile request:', dto);
    try {
      const result = await this.userService.createUserProfile(dto);
      console.log(
        '[USER-SERVICE] ✅ User profile created successfully:',
        result.id,
      );
      return result;
    } catch (error: any) {
      console.error('[USER-SERVICE] ❌ Error creating user profile:', error);
      console.error('[USER-SERVICE] Error type:', error?.constructor?.name);
      console.error('[USER-SERVICE] Error message:', error?.message);
      console.error('[USER-SERVICE] Error stack:', error?.stack);
      // Re-throw the original error to preserve the error message
      throw error;
    }
  }

  @Post('/internal/update-user-email')
  @ApiExcludeEndpoint()
  @InternalRoute()
  async updateEmail(@Body() dto: updateUserEmailByServiceDto) {
    console.log('----------', dto);
    return this.userService.updateUserEmail(dto).catch(() => {
      throw new BadRequestException('User email update failed in user service');
    });
  }

  // ✅ ADMIN-only: get all users
  @Get()
  @FindAllUsersSwagger()
  @Roles(UserRole.ADMIN)
  // @Public()
  findAll(@Query() query: FindUsersQueryDto) {
    return this.userService.findAll(query);
  }
  // ✅ ADMIN-only: get all users
  @Post('internal/recommends')
  @ApiExcludeEndpoint()
  @FindProsSwagger()
  @InternalRoute()
  findRecommends(@Body() body: FindProsDto) {
    return this.userService.findRecommends(body.proIds);
  }
  // ✅ Public route: get single user profile
  @Get(':id')
  @FindUserSwagger()
  findOne(@Param('id') id: string, @Req() req) {
    return this.userService.findOne(id, req.user);
  }

  // ✅ Owner/Admin can update
  @Patch(':id')
  @UpdateUserSwagger()
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req) {
    return this.userService.update(id, dto, req.user);
  }

  // ✅ Only ADMINs can delete users
  @Delete(':id')
  @DeleteUserSwagger()
  remove(@Param('id') id: string, @Req() req) {
    return this.userService.remove(id, req.user);
  }

  @InternalRoute()
  @Get('role-by-id/:id')
  getUserRole(@Param('id') id: string) {
    return this.userService.getRoleById(id);
  }

  @Patch(':id/role')
  @UpdateUserRoleSwagger()
  @Roles(UserRole.ADMIN)
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    return this.userService.updateRole(id, dto);
  }

  // user.controller.ts
  @Post('batch')
  @InternalRoute()
  getUsersByIds(@Body() body: { ids: string[] }) {
    return this.userService.findManyByIds(body.ids);
  }

  @Get('internal/verify-email/:id')
  @ApiExcludeEndpoint()
  @InternalRoute()
  verifyEmail(@Param('id') id: string) {
    return this.userService.verifyEmail(id);
  }

  @Get('profile/:id')
  @FindUserSwagger()
  @InternalRoute()
  findProfile(@Param('id') id: string) {
    return this.userService.findProfile(id);
  }
}
