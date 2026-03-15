import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserByServiceDto,
  UpdateUserDto,
  UpdateUserRoleDto,
  UserResponseDto,
  UserRoleResponseDto,
} from './dto';

import { FindUsersQueryDto } from './dto/get-users-query.dto';
import { Prisma, UserRole } from '@prisma/client';
import { formatResponse } from '../common/format-response.util';
import { mapToDto } from 'src/common/map-to-dto.util';
import { updateUserEmailByServiceDto } from './dto/service/update-email.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,

    private prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}
  // This call only via auth service
  async createUserProfile(dto: CreateUserByServiceDto) {
    console.log('dto in user serivice: ', dto);
    const existing = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    console.log('existing', existing);
    if (existing) {
      throw new BadRequestException('Profile already exists');
    }

    const email = dto.email;
    console.log('email', email);

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const validRoles = ['CUSTOMER', 'DRIVER', 'ADMIN']; // Replace with actual enum values
    if (!validRoles.includes(dto.role)) {
      console.log('dto.role', dto.role);
      throw new BadRequestException('Invalid role');
    }

    const user = await this.prisma.user.create({
      data: {
        id: dto.userId, // map userId -> id
        email: dto.email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        phone: dto.phone,
        role: dto.role as UserRole, // cast to enum if it matches
      },
    });

    console.log('uuuuuuser', user);

    // this.notificationClient.emit('send_notification', {
    //   type: 'ONE_TIME',
    //   channel: 'EMAIL',
    //   title: 'Welcome!',
    //   message: 'Thanks for signing up 🎉',
    // });
    // console.log('uuuuuuser: ', user);
    return user;
  }

  async updateUserEmail(dto: updateUserEmailByServiceDto) {
    await this.prisma.user.update({
      where: { id: dto.userId },
      data: { email: dto.email },
    });
  }

  async findAll(query: FindUsersQueryDto) {
    const { search, page = 1, limit = 10, orderBy = 'desc', role } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      isDeleted: false,
      ...(search && {
        OR: [
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
          {
            first_name: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }),
      ...(role && { role }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: orderBy },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return formatResponse({
      data,
      paginationMeta: { total, page, limit },
      message: 'List fetched successfully',
    });
  }

  async findRecommends(proIds: string[]) {
    if (!proIds || proIds.length === 0) {
      return formatResponse({
        data: [],
        message: 'No Pro IDs provided',
      });
    }

    const data = await this.prisma.user.findMany({
      where: {
        id: { in: proIds },
        isDeleted: false,
        role: 'DRIVER',
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
        // add any more fields you want
      },
    });

    return formatResponse({
      data,
      message: 'Pro users fetched successfully',
    });
  }

  async findOne(id: string, requester: { userId: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        bio: true,
        phone: true,
        role: true,
        avatar: true,
        createdAt: true,
        isDeleted: true, // include isDeleted field
      },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }

    const isOwner = user.id === requester.userId;
    const isAdmin = requester.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    // Remove isDeleted from response if you don't want to expose it
    const { isDeleted, ...safeUser } = user;

    return formatResponse({
      data: safeUser,
      message: 'User retrieved successfully',
    });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    requester: { userId: string; role: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        isDeleted: true,
        avatar: true, // Fetch current avatar for comparison
      },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }

    const isOwner = user.id === requester.userId;
    const isAdmin = requester.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to update this user',
      );
    }

    const previousAvatar = user.avatar as { id: string; url: string } | null;
    const newAvatar = dto.avatar;

    const isAvatarChanged =
      previousAvatar && newAvatar && previousAvatar.id !== newAvatar.id;

    // ✅ If avatar changed, delete previous avatar from Upload Service
    if (isAvatarChanged) {
      try {
        // 👇 Call upload service to delete the old file
        await lastValueFrom(
          this.httpService.delete(
            `${process.env.BASE_API_URL}/api/uploads/delete-internal/${previousAvatar.id}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
              },
            },
          ),
        );
      } catch (error) {
        console.warn(
          `⚠️ Failed to delete old avatar from UploadService:`,
          error?.response?.data || error?.message || error,
        );
      }
    }

    const phone = dto.phone ?? dto.phone_number;
    const updatePayload: Record<string, unknown> = {
      first_name: dto.first_name,
      last_name: dto.last_name,
      bio: dto.bio,
      phone,
      avatar: newAvatar ? { ...newAvatar } : undefined,
    };
    // Omit undefined so Prisma only updates provided fields
    const data = Object.fromEntries(
      Object.entries(updatePayload).filter(([, v]) => v !== undefined),
    ) as Parameters<typeof this.prisma.user.update>[0]['data'];

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
    });

    return formatResponse({
      success: true,
      data: mapToDto(UserResponseDto, updatedUser),
      message: 'User updated successfully',
    });
  }
  async verifyEmail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        isDeleted: true,
        isVerified: true,
      },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id },
      data: { isVerified: true },
    });

    return { isVerified: true };
  }
  async remove(id: string, requester: { userId: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isOwner = user.id === requester.userId;
    const isAdmin = requester.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to delete this user',
      );
    }

    // 1️⃣ Delete from local database
    await this.prisma.user.delete({
      where: { id },
    });

    // 2️⃣ Send internal request to Auth Service
    try {
      await lastValueFrom(
        this.httpService.delete(`${process.env.BASE_API_URL}/api/auth/${id}`, {
          headers: {
            Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
          },
        }),
      );
    } catch (error) {
      // Optionally log or handle the error, but local deletion already happened
      console.error('Failed to delete user in Auth Service:', error.message);
    }

    return {
      success: true,
      message: 'User deleted permanently',
    };
  }

  async getRoleById(id: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        role: true,
        isVerified: true,
        isDeleted: true,
        isBlocked: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateRole(id: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        isDeleted: true,
        role: true,
      },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
    });

    return formatResponse({
      success: true,
      data: mapToDto(UserRoleResponseDto, updatedUser),
      message: 'User role updated successfully',
    });
  }

  async findManyByIds(ids: string[]) {
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        avatar: true,
      },
    });
  }

  async findProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        createdAt: true,
        isDeleted: true, // include isDeleted field
      },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }
    return user;
    // return formatResponse({
    //   data: user,
    //   message: 'User retrieved successfully',
    // });
  }
}
