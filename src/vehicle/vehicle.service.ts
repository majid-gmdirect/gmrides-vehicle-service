import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import {
  Prisma,
  InspectionType,
  DocumentStatus,
  VehicleDocumentKind,
} from '@prisma/client';
import { lastValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { formatResponse } from '../common/format-response.util';
import {
  CreateVehicleDto,
  CreateVehicleImageDto,
  CreateVehicleInspectionDto,
  CreateVehicleInsuranceDto,
  CreateVehiclePcoDocumentDto,
  CreatePermissionLetterDto,
  CreateVehicleScheduleDto,
  CreateLogBookV5Dto,
  ListVehiclesQueryDto,
  AdminReviewPermissionLetterDto,
  AdminReviewVehicleScheduleDto,
  AdminReviewLogBookV5Dto,
  UpdateVehicleRequestOptionalDocumentsDto,
  UpdateVehicleActiveDto,
  UpdateVehicleApprovedDto,
  UpdateVehicleDto,
  UpdateVehicleInspectionDto,
  UpdateVehicleInsuranceDto,
  UpdateVehiclePcoDocumentDto,
  UpdatePermissionLetterDto,
  UpdateVehicleScheduleDto,
  UpdateLogBookV5Dto,
} from './dto';
import {
  tryNotifyDriverVehicleDocumentAccepted,
  tryNotifyDriverVehicleDocumentRejected,
  tryNotifyDriverVehicleApproved,
} from '../common/vehicle-document-driver-notification.util';
import { applyDriverResubmissionReviewReset } from '../common/reset-document-on-driver-resubmission.util';
import { normalizeToReviewStatus } from '../common/document-review-status.util';
import {
  classifyExpiryBucket,
  daysUntilExpiry,
  DocumentExpiryItem,
  sortByDaysUntilExpiry,
} from '../common/document-expiry.util';
import { assertDriverMayMutateLiveVehicleDocument } from '../common/vehicle-document-mutation.policy';
import { attachPendingToVehicleDocumentRows } from '../common/pending-vehicle-document-change-request.util';
import { assertDriverMayMutateLiveVehicle } from '../common/vehicle-mutation.policy';
import { attachPendingToVehicleRows } from '../common/pending-vehicle-change-request.util';

type Requester = { userId: string; role?: string };

function toPrismaDateTime(value: string): Date {
  if (value.includes('T')) return new Date(value);
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class VehicleService {
  private readonly logger = new Logger(VehicleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  private mergeAdminReviewFieldsOnCreate(
    isAdmin: boolean,
    status: DocumentStatus | undefined,
    rejectedReason: string | undefined,
  ): Partial<{ status: DocumentStatus; rejectedReason: string | null }> {
    if (!isAdmin) return {};
    const out: Partial<{ status: DocumentStatus; rejectedReason: string | null }> =
      {};
    if (status !== undefined) {
      out.status = status;
      if (status !== DocumentStatus.REJECTED) {
        out.rejectedReason = rejectedReason ?? null;
      } else if (rejectedReason !== undefined) {
        out.rejectedReason = rejectedReason;
      }
    } else if (rejectedReason !== undefined) {
      out.rejectedReason = rejectedReason;
    }
    return out;
  }

  private mergeAdminReviewFieldsOnUpdate(
    isAdmin: boolean,
    data:
      | Prisma.VehicleInspectionUpdateInput
      | Prisma.VehicleInsuranceUpdateInput
      | Prisma.VehiclePcoDocumentUpdateInput,
    status: DocumentStatus | undefined,
    rejectedReason: string | undefined,
  ): void {
    if (!isAdmin) return;
    if (status !== undefined) {
      data.status = status;
      if (status !== DocumentStatus.REJECTED) {
        data.rejectedReason = rejectedReason ?? null;
      } else if (rejectedReason !== undefined) {
        data.rejectedReason = rejectedReason;
      }
    } else if (rejectedReason !== undefined) {
      data.rejectedReason = rejectedReason;
    }
  }

  private notifyVehicleDocumentReviewOutcomeIfNeeded(
    driverId: string,
    targetType: VehicleDocumentKind,
    existingStatus: DocumentStatus,
    updated: { status: DocumentStatus; rejectedReason?: string | null },
  ): void {
    if (
      updated.status === DocumentStatus.REJECTED &&
      existingStatus !== DocumentStatus.REJECTED
    ) {
      void tryNotifyDriverVehicleDocumentRejected(
        this.notificationClient,
        this.logger,
        {
          driverUserId: driverId,
          targetType,
          rejectedReason: updated.rejectedReason,
        },
      );
    }
    if (
      updated.status === DocumentStatus.ACCEPTED &&
      existingStatus !== DocumentStatus.ACCEPTED
    ) {
      void tryNotifyDriverVehicleDocumentAccepted(
        this.notificationClient,
        this.logger,
        {
          driverUserId: driverId,
          targetType,
        },
      );
    }
  }

  private assertDriverAccess(driverId: string, requester: Requester) {
    const isOwner = driverId === requester.userId;
    const isAdmin = requester.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to access this driver vehicles',
      );
    }
  }

  private async assertDriverExistsAndIsDriver(driverId: string): Promise<void> {
    const baseUrl = process.env.BASE_API_URL;
    if (!baseUrl) {
      throw new BadRequestException('BASE_API_URL is not configured');
    }
    if (!process.env.INTERNAL_API_KEY) {
      throw new BadRequestException('INTERNAL_API_KEY is not configured');
    }

    try {
      const res = await lastValueFrom(
        this.httpService.get(
          `${baseUrl}/api/users/main/role-by-id/${driverId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
            },
          },
        ),
      );

      const role = res?.data?.role;
      const isDeleted = res?.data?.isDeleted;
      const isBlocked = res?.data?.isBlocked;

      if (isDeleted) throw new NotFoundException('Driver not found');
      if (isBlocked) {
        throw new BadRequestException('Driver is blocked');
      }
      if (role !== 'DRIVER') {
        throw new BadRequestException('Target user is not a driver');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) throw new NotFoundException('Driver not found');
      if (status === 401) {
        throw new BadRequestException('Internal user-service auth failed');
      }
      // Bubble up known Nest exceptions
      if (err instanceof NotFoundException) throw err;
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Failed to validate driverId with user service');
    }
  }

  private toPublicDriverShape(input: any) {
    if (!input) return null;
    // driver-service returns `{ userId, ..., user: { first_name, last_name, ... } }`
    // user batch fallback returns `{ user: { first_name, last_name, ... } }`
    const user = input?.user;
    const userId = input?.userId ?? user?.id;

    const base =
      user && (user.first_name || user.last_name || user.email || user.avatar !== undefined)
        ? {
            id: userId,
            firstName: user.first_name ?? null,
            lastName: user.last_name ?? null,
            email: user.email ?? null,
            avatar: user.avatar ?? null,
          }
        : userId
          ? { id: userId }
          : {};

    // Include driver profile fields if present (without nesting `user`)
    const { user: _user, ...rest } = input ?? {};
    return {
      ...base,
      ...rest,
    };
  }

  private async fetchDriverIdsByName(search: string): Promise<string[]> {
    const baseUrl = process.env.BASE_API_URL;
    if (!baseUrl) {
      throw new BadRequestException('BASE_API_URL is not configured');
    }
    if (!process.env.INTERNAL_API_KEY) {
      throw new BadRequestException('INTERNAL_API_KEY is not configured');
    }

    const q = search.trim();
    if (!q) return [];

    try {
      const headers = {
        Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
      };

      const fetchIds = async (term: string): Promise<string[]> => {
        try {
          // Preferred: user-service internal endpoint that searches DRIVER users directly.
          const res = await lastValueFrom(
            this.httpService.get(`${baseUrl}/api/users/main/internal/driver-ids`, {
              headers,
              params: { search: term },
            }),
          );
          const ids: any[] = res?.data?.ids ?? [];
          return ids.filter((id: any) => typeof id === 'string' && id.length > 0);
        } catch (e: any) {
          const status = e?.response?.status;
          // Next best: use the existing user list endpoint (searches Users, not driver profiles).
          // This is important in prod where the gateway may not route /internal/driver-ids yet.
          if (status === 404) {
            try {
              const res = await lastValueFrom(
                this.httpService.get(`${baseUrl}/api/users/main`, {
                  headers,
                  params: {
                    search: term,
                    role: 'DRIVER',
                    page: 1,
                    limit: 200,
                  },
                }),
              );
              const users: any[] = res?.data?.data ?? [];
              return users
                .map((u) => u?.id)
                .filter((id: any) => typeof id === 'string' && id.length > 0);
            } catch {
              // fall through to legacy driver-profile endpoint
            }
          }
          // Backwards-compatible fallback: older user-service versions only have `/internal/drivers`
          if (status === 404) {
            const res = await lastValueFrom(
              this.httpService.get(`${baseUrl}/api/users/main/internal/drivers`, {
                headers,
                params: {
                  search: term,
                  page: 1,
                  limit: 100,
                },
              }),
            );
            const drivers: any[] = res?.data?.data ?? [];
            return drivers
              .map((d) => d?.userId ?? d?.user?.id)
              .filter((id: any) => typeof id === 'string' && id.length > 0);
          }
          throw e;
        }
      };

      // User-service search likely does a "contains" on one field at a time.
      // So "first last" often won't match. We handle that by splitting and intersecting.
      const terms = q.split(/\s+/).filter(Boolean);

      const fullMatchIds = await fetchIds(q);
      if (terms.length <= 1) {
        return Array.from(new Set(fullMatchIds));
      }

      // Fetch ids per term and intersect for precision (hadi AND alizada)
      const perTerm = await Promise.all(terms.map((t) => fetchIds(t)));
      const sets = perTerm.map((arr) => new Set(arr));
      const intersection = perTerm[0].filter((id) => sets.every((s) => s.has(id)));

      // If intersection is empty (edge cases), fall back to union to be permissive
      const union = Array.from(new Set([...fullMatchIds, ...perTerm.flat()]));
      return intersection.length ? Array.from(new Set(intersection)) : union;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        throw new BadRequestException('Internal user-service auth failed');
      }
      // Non-fatal for vehicle search: if user-service search is down, don't break vehicle listing
      return [];
    }
  }

  private async fetchDriversByIds(driverIds: string[]) {
    const baseUrl = process.env.BASE_API_URL;
    if (!baseUrl) {
      throw new BadRequestException('BASE_API_URL is not configured');
    }
    if (!process.env.INTERNAL_API_KEY) {
      throw new BadRequestException('INTERNAL_API_KEY is not configured');
    }

    const ids = Array.from(new Set(driverIds.filter(Boolean)));
    if (ids.length === 0) return new Map<string, any>();

    try {
      const headers = {
        Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
      };

      // Prefer enriched "driver profile + user" when available
      const driverRes = await lastValueFrom(
        this.httpService.post(
          `${baseUrl}/api/users/driver/bulk/by-ids`,
          { ids },
          { headers },
        ),
      );
      const drivers: any[] = driverRes?.data ?? [];

      const map = new Map<string, any>();
      for (const d of drivers) {
        const userId = d?.userId ?? d?.user?.id;
        if (userId) map.set(userId, d);
      }

      // Fallback: some users may not have a driver profile row yet.
      // In that case, fetch basic user info so "driver" isn't null.
      const missing = ids.filter((id) => !map.has(id));
      if (missing.length) {
        const userRes = await lastValueFrom(
          this.httpService.post(
            `${baseUrl}/api/users/main/batch`,
            { ids: missing },
            { headers },
          ),
        );
        const users: any[] = userRes?.data ?? [];
        for (const u of users) {
          const userId = u?.id;
          if (userId) map.set(userId, { user: u });
        }
      }

      const shaped = new Map<string, any>();
      for (const [id, value] of map.entries()) {
        shaped.set(id, this.toPublicDriverShape(value));
      }
      return shaped;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        throw new BadRequestException('Internal user-service auth failed');
      }
      throw new BadRequestException('Failed to fetch driver info from user service');
    }
  }

  private async getVehicleOrThrow(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  private async getVehicleForDriverOrThrow(driverId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, driverId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async createVehicle(driverId: string, dto: CreateVehicleDto, requester: Requester) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);

    const normalizedPlate = dto.plateNumber.trim().toUpperCase();

    const existingPlate = await this.prisma.vehicle.findUnique({
      where: { plateNumber: normalizedPlate },
      select: { id: true },
    });
    if (existingPlate) {
      throw new BadRequestException('Plate number already exists');
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        driverId,
        make: dto.make.trim(),
        model: dto.model.trim(),
        year: dto.year,
        color: dto.color?.trim(),
        plateNumber: normalizedPlate,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.permission_letter !== undefined && {
          permission_letter: dto.permission_letter as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.vehicle_schedule !== undefined && {
          vehicle_schedule: dto.vehicle_schedule as unknown as Prisma.InputJsonValue,
        }),
      },
    });

    return formatResponse({
      success: true,
      data: vehicle,
      message: 'Vehicle created successfully',
    });
  }

  async listVehiclesByDriver(
    driverId: string,
    requester: Requester,
    query?: ListVehiclesQueryDto,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    const { search } = query ?? {};

    const where: Prisma.VehicleWhereInput = {
      driverId,
      ...(search && {
        OR: [
          {
            plateNumber: {
              contains: search.trim(),
              mode: Prisma.QueryMode.insensitive,
            },
          },
          { make: { contains: search.trim(), mode: Prisma.QueryMode.insensitive } },
          { model: { contains: search.trim(), mode: Prisma.QueryMode.insensitive } },
        ],
      }),
    };

    const vehicles = await this.prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        images: true,
        inspections: true,
        insurances: true,
        pcoDocs: true,
      },
    });

    const data = await attachPendingToVehicleRows(this.prisma, vehicles);

    return formatResponse({
      success: true,
      data,
      message: 'Vehicles retrieved successfully',
    });
  }

  async getVehicleByDriver(
    driverId: string,
    vehicleId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, driverId },
      include: {
        images: true,
        inspections: true,
        insurances: true,
        pcoDocs: true,
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const [data] = await attachPendingToVehicleRows(this.prisma, [vehicle]);

    return formatResponse({
      success: true,
      data,
      message: 'Vehicle retrieved successfully',
    });
  }

  async updateVehicle(
    driverId: string,
    vehicleId: string,
    dto: UpdateVehicleDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    const existing = await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicle(isAdmin, existing.isApproved);

    const data: Prisma.VehicleUpdateInput = {};
    if (dto.make !== undefined) data.make = dto.make.trim();
    if (dto.model !== undefined) data.model = dto.model.trim();
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.color !== undefined) data.color = dto.color?.trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.permission_letter !== undefined) {
      data.permission_letter = dto.permission_letter as unknown as Prisma.InputJsonValue;
    }
    if (dto.vehicle_schedule !== undefined) {
      data.vehicle_schedule = dto.vehicle_schedule as unknown as Prisma.InputJsonValue;
    }
    if (dto.requiestOptionalDocuments !== undefined) {
      if (!isAdmin) {
        throw new ForbiddenException('Admin access required');
      }
      data.requiestOptionalDocuments = dto.requiestOptionalDocuments;
    }

    if (dto.plateNumber !== undefined) {
      const normalizedPlate = dto.plateNumber.trim().toUpperCase();
      const existingPlate = await this.prisma.vehicle.findUnique({
        where: { plateNumber: normalizedPlate },
        select: { id: true },
      });
      if (existingPlate && existingPlate.id !== vehicleId) {
        throw new BadRequestException('Plate number already exists');
      }
      data.plateNumber = normalizedPlate;
    }

    const vehicle = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data,
    });

    const [mapped] = await attachPendingToVehicleRows(this.prisma, [vehicle]);

    return formatResponse({
      success: true,
      data: mapped,
      message: 'Vehicle updated successfully',
    });
  }

  async deleteVehicle(driverId: string, vehicleId: string, requester: Requester) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    const existing = await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicle(isAdmin, existing.isApproved);

    await this.prisma.vehicle.delete({ where: { id: vehicleId } });

    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle deleted successfully',
    });
  }

  private buildVehicleExpiredDocumentWhere(
    reference = new Date(),
  ): Prisma.VehicleWhereInput {
    return {
      OR: [
        {
          inspections: {
            some: {
              status: DocumentStatus.ACCEPTED,
              expiryDate: { not: null, lt: reference },
            },
          },
        },
        {
          insurances: {
            some: {
              status: DocumentStatus.ACCEPTED,
              endDate: { not: null, lt: reference },
            },
          },
        },
        {
          pcoDocs: {
            some: {
              status: DocumentStatus.ACCEPTED,
              expiryDate: { not: null, lt: reference },
            },
          },
        },
      ],
    };
  }

  async adminListVehicles(query: ListVehiclesQueryDto) {
    const {
      search,
      page = 1,
      limit = 10,
      orderBy = 'desc',
      isActive,
      isApproved,
      isExpired,
    } = query;
    const skip = (page - 1) * limit;
    const expiredDocumentWhere = this.buildVehicleExpiredDocumentWhere();

    const where: Prisma.VehicleWhereInput = {
      ...(search && {
        OR: [
          {
            plateNumber: {
              contains: search.trim(),
              mode: Prisma.QueryMode.insensitive,
            },
          },
          { make: { contains: search.trim(), mode: Prisma.QueryMode.insensitive } },
          { model: { contains: search.trim(), mode: Prisma.QueryMode.insensitive } },
          { driverId: { contains: search.trim(), mode: Prisma.QueryMode.insensitive } },
        ],
      }),
      ...(isActive !== undefined && { isActive }),
      ...(isApproved !== undefined && { isApproved }),
      ...(isExpired === true && expiredDocumentWhere),
      ...(isExpired === false && { NOT: expiredDocumentWhere }),
    };

    // If search looks like a name, resolve matching driverIds via user-service and filter by those ids too.
    if (search?.trim()) {
      const driverIdsByName = await this.fetchDriverIdsByName(search);
      if (driverIdsByName.length) {
        where.OR = [
          ...(where.OR ?? []),
          {
            driverId: {
              in: driverIdsByName,
            },
          },
        ];
      }
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: orderBy },
        include: {
          images: true,
          logBookV5: true,
          inspections: true,
          insurances: true,
          pcoDocs: true,
          permissionLetters: true,
          vehicleSchedules: true,
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    const driverMap = await this.fetchDriversByIds(data.map((v) => v.driverId));
    const enriched = data.map((v) => ({
      ...v,
      driver: driverMap.get(v.driverId) ?? null,
    }));

    return formatResponse({
      success: true,
      data: enriched,
      paginationMeta: { total, page, limit },
      message: 'Vehicles fetched successfully',
    });
  }

  async adminApproveVehicle(vehicleId: string, dto: UpdateVehicleApprovedDto) {
    const existing = await this.getVehicleOrThrow(vehicleId);

    const vehicle = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isApproved: dto.isApproved },
    });

    if (dto.isApproved && !existing.isApproved) {
      void tryNotifyDriverVehicleApproved(
        this.notificationClient,
        this.logger,
        { driverUserId: vehicle.driverId },
      );
    }

    return formatResponse({
      success: true,
      data: vehicle,
      message: 'Vehicle approval updated successfully',
    });
  }

  async adminSetActive(vehicleId: string, dto: UpdateVehicleActiveDto) {
    await this.getVehicleOrThrow(vehicleId);

    const vehicle = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: dto.isActive },
    });

    return formatResponse({
      success: true,
      data: vehicle,
      message: 'Vehicle active status updated successfully',
    });
  }

  async adminRequestOptionalDocuments(
    vehicleId: string,
    dto: UpdateVehicleRequestOptionalDocumentsDto,
  ) {
    await this.getVehicleOrThrow(vehicleId);

    const vehicle = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { requiestOptionalDocuments: dto.requiestOptionalDocuments },
    });

    return formatResponse({
      success: true,
      data: vehicle,
      message: 'Vehicle optional document request updated successfully',
    });
  }

  private async maybeClearOptionalDocumentsRequest(vehicleId: string): Promise<void> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { requiestOptionalDocuments: true },
    });
    if (!vehicle?.requiestOptionalDocuments) return;

    const [acceptedPermissionLetter, acceptedSchedule] = await Promise.all([
      this.prisma.permissionLetter.findFirst({
        where: { vehicleId, status: DocumentStatus.ACCEPTED },
        select: { id: true },
      }),
      this.prisma.vehicleSchedule.findFirst({
        where: { vehicleId, status: DocumentStatus.ACCEPTED },
        select: { id: true },
      }),
    ]);

    if (acceptedPermissionLetter && acceptedSchedule) {
      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: { requiestOptionalDocuments: false },
      });
    }
  }

  // -----------------------
  // Images
  // -----------------------
  async listImages(
    driverId: string,
    vehicleId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const images = await this.prisma.vehicleImage.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    return formatResponse({
      success: true,
      data: images,
      message: 'Vehicle images retrieved successfully',
    });
  }

  async getImage(
    driverId: string,
    vehicleId: string,
    imageId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const image = await this.prisma.vehicleImage.findFirst({
      where: { id: imageId, vehicleId },
    });
    if (!image) throw new NotFoundException('Vehicle image not found');

    return formatResponse({
      success: true,
      data: image,
      message: 'Vehicle image retrieved successfully',
    });
  }

  async addImage(
    driverId: string,
    vehicleId: string,
    dto: CreateVehicleImageDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const image = await this.prisma.vehicleImage.create({
      data: {
        vehicleId,
        type: dto.type,
        image: dto.image as Prisma.InputJsonValue,
      },
    });

    return formatResponse({
      success: true,
      data: image,
      message: 'Vehicle image added successfully',
    });
  }

  async deleteImage(
    driverId: string,
    vehicleId: string,
    imageId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleImage.findFirst({
      where: { id: imageId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle image not found');

    await this.prisma.vehicleImage.delete({ where: { id: imageId } });
    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle image deleted successfully',
    });
  }

  // -----------------------
  // Inspections
  // -----------------------
  async listInspections(
    driverId: string,
    vehicleId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const inspections = await this.prisma.vehicleInspection.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    const data = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.INSPECTION,
      inspections,
    );

    return formatResponse({
      success: true,
      data,
      message: 'Vehicle inspections retrieved successfully',
    });
  }

  async getInspection(
    driverId: string,
    vehicleId: string,
    inspectionId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const inspection = await this.prisma.vehicleInspection.findFirst({
      where: { id: inspectionId, vehicleId },
    });
    if (!inspection) throw new NotFoundException('Vehicle inspection not found');

    const [data] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.INSPECTION,
      [inspection],
    );

    return formatResponse({
      success: true,
      data,
      message: 'Vehicle inspection retrieved successfully',
    });
  }

  async createInspection(
    driverId: string,
    vehicleId: string,
    dto: CreateVehicleInspectionDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const isAdmin = requester.role === 'ADMIN';
    const { status, rejectedReason, ...rest } = dto;
    const review = this.mergeAdminReviewFieldsOnCreate(
      isAdmin,
      status,
      rejectedReason,
    );

    const inspection = await this.prisma.vehicleInspection.create({
      data: {
        vehicleId,
        ...review,
        ...(rest.inspectionType !== undefined && {
          inspectionType: rest.inspectionType as InspectionType,
        }),
        ...(rest.inspectionDate !== undefined && {
          inspectionDate: toPrismaDateTime(rest.inspectionDate),
        }),
        ...(rest.expiryDate !== undefined && {
          expiryDate: toPrismaDateTime(rest.expiryDate),
        }),
        ...(rest.document !== undefined && {
          document: rest.document as Prisma.InputJsonValue,
        }),
      },
    });

    if (isAdmin) {
      this.notifyVehicleDocumentReviewOutcomeIfNeeded(
        driverId,
        VehicleDocumentKind.INSPECTION,
        DocumentStatus.PENDING,
        inspection,
      );
    }

    return formatResponse({
      success: true,
      data: inspection,
      message: 'Vehicle inspection created successfully',
    });
  }

  async updateInspection(
    driverId: string,
    vehicleId: string,
    inspectionId: string,
    dto: UpdateVehicleInspectionDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleInspection.findFirst({
      where: { id: inspectionId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle inspection not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    const { status, rejectedReason, ...rest } = dto;

    const data: Prisma.VehicleInspectionUpdateInput = {};
    if (rest.inspectionType !== undefined) {
      data.inspectionType = rest.inspectionType as InspectionType;
    }
    if (rest.inspectionDate !== undefined) {
      data.inspectionDate = toPrismaDateTime(rest.inspectionDate);
    }
    if (rest.expiryDate !== undefined) {
      data.expiryDate = rest.expiryDate
        ? toPrismaDateTime(rest.expiryDate)
        : null;
    }
    if (rest.document !== undefined) {
      data.document = rest.document as Prisma.InputJsonValue;
    }
    applyDriverResubmissionReviewReset(
      isAdmin,
      existing.status,
      data,
      Object.keys(data).length > 0,
    );
    this.mergeAdminReviewFieldsOnUpdate(isAdmin, data, status, rejectedReason);

    const inspection = await this.prisma.vehicleInspection.update({
      where: { id: inspectionId },
      data,
    });

    const [mapped] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.INSPECTION,
      [inspection],
    );

    if (isAdmin) {
      this.notifyVehicleDocumentReviewOutcomeIfNeeded(
        driverId,
        VehicleDocumentKind.INSPECTION,
        existing.status,
        inspection,
      );
    }

    return formatResponse({
      success: true,
      data: mapped,
      message: 'Vehicle inspection updated successfully',
    });
  }

  async deleteInspection(
    driverId: string,
    vehicleId: string,
    inspectionId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleInspection.findFirst({
      where: { id: inspectionId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle inspection not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    await this.prisma.vehicleInspection.delete({ where: { id: inspectionId } });
    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle inspection deleted successfully',
    });
  }

  // -----------------------
  // Insurances
  // -----------------------
  async listInsurances(
    driverId: string,
    vehicleId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const insurances = await this.prisma.vehicleInsurance.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    const data = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.INSURANCE,
      insurances,
    );

    return formatResponse({
      success: true,
      data,
      message: 'Vehicle insurances retrieved successfully',
    });
  }

  async getInsurance(
    driverId: string,
    vehicleId: string,
    insuranceId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const insurance = await this.prisma.vehicleInsurance.findFirst({
      where: { id: insuranceId, vehicleId },
    });
    if (!insurance) throw new NotFoundException('Vehicle insurance not found');

    const [data] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.INSURANCE,
      [insurance],
    );

    return formatResponse({
      success: true,
      data,
      message: 'Vehicle insurance retrieved successfully',
    });
  }

  async createInsurance(
    driverId: string,
    vehicleId: string,
    dto: CreateVehicleInsuranceDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const isAdmin = requester.role === 'ADMIN';
    const { status, rejectedReason, ...rest } = dto;
    const review = this.mergeAdminReviewFieldsOnCreate(
      isAdmin,
      status,
      rejectedReason,
    );

    const insurance = await this.prisma.vehicleInsurance.create({
      data: {
        vehicleId,
        ...review,
        ...(rest.provider !== undefined && { provider: rest.provider }),
        ...(rest.policyNumber !== undefined && {
          policyNumber: rest.policyNumber,
        }),
        ...(rest.startDate !== undefined && {
          startDate: toPrismaDateTime(rest.startDate),
        }),
        ...(rest.endDate !== undefined && {
          endDate: toPrismaDateTime(rest.endDate),
        }),
        ...(rest.document !== undefined && {
          document: rest.document as Prisma.InputJsonValue,
        }),
      },
    });

    if (isAdmin) {
      this.notifyVehicleDocumentReviewOutcomeIfNeeded(
        driverId,
        VehicleDocumentKind.INSURANCE,
        DocumentStatus.PENDING,
        insurance,
      );
    }

    return formatResponse({
      success: true,
      data: insurance,
      message: 'Vehicle insurance created successfully',
    });
  }

  async updateInsurance(
    driverId: string,
    vehicleId: string,
    insuranceId: string,
    dto: UpdateVehicleInsuranceDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleInsurance.findFirst({
      where: { id: insuranceId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle insurance not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    const { status, rejectedReason, ...rest } = dto;

    const data: Prisma.VehicleInsuranceUpdateInput = {};
    if (rest.provider !== undefined) data.provider = rest.provider;
    if (rest.policyNumber !== undefined) data.policyNumber = rest.policyNumber;
    if (rest.startDate !== undefined) {
      data.startDate = toPrismaDateTime(rest.startDate);
    }
    if (rest.endDate !== undefined) {
      data.endDate = rest.endDate ? toPrismaDateTime(rest.endDate) : null;
    }
    if (rest.document !== undefined) {
      data.document = rest.document as Prisma.InputJsonValue;
    }
    applyDriverResubmissionReviewReset(
      isAdmin,
      existing.status,
      data,
      Object.keys(data).length > 0,
    );
    this.mergeAdminReviewFieldsOnUpdate(isAdmin, data, status, rejectedReason);

    const insurance = await this.prisma.vehicleInsurance.update({
      where: { id: insuranceId },
      data,
    });

    const [mapped] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.INSURANCE,
      [insurance],
    );

    if (isAdmin) {
      this.notifyVehicleDocumentReviewOutcomeIfNeeded(
        driverId,
        VehicleDocumentKind.INSURANCE,
        existing.status,
        insurance,
      );
    }

    return formatResponse({
      success: true,
      data: mapped,
      message: 'Vehicle insurance updated successfully',
    });
  }

  async deleteInsurance(
    driverId: string,
    vehicleId: string,
    insuranceId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleInsurance.findFirst({
      where: { id: insuranceId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle insurance not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    await this.prisma.vehicleInsurance.delete({ where: { id: insuranceId } });
    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle insurance deleted successfully',
    });
  }

  // -----------------------
  // PCO documents
  // -----------------------
  async listPcoDocs(
    driverId: string,
    vehicleId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const pcoDocs = await this.prisma.vehiclePcoDocument.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    const data = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.PCO_DOCUMENT,
      pcoDocs,
    );

    return formatResponse({
      success: true,
      data,
      message: 'Vehicle PCO documents retrieved successfully',
    });
  }

  async getPcoDoc(
    driverId: string,
    vehicleId: string,
    pcoDocId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const doc = await this.prisma.vehiclePcoDocument.findFirst({
      where: { id: pcoDocId, vehicleId },
    });
    if (!doc) throw new NotFoundException('Vehicle PCO document not found');

    const [data] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.PCO_DOCUMENT,
      [doc],
    );

    return formatResponse({
      success: true,
      data,
      message: 'Vehicle PCO document retrieved successfully',
    });
  }

  async createPcoDoc(
    driverId: string,
    vehicleId: string,
    dto: CreateVehiclePcoDocumentDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const isAdmin = requester.role === 'ADMIN';
    const { status, rejectedReason, ...rest } = dto;
    const review = this.mergeAdminReviewFieldsOnCreate(
      isAdmin,
      status,
      rejectedReason,
    );

    const doc = await this.prisma.vehiclePcoDocument.create({
      data: {
        vehicleId,
        ...review,
        ...(rest.badgeNumber !== undefined && { badgeNumber: rest.badgeNumber }),
        ...(rest.issueDate !== undefined && {
          issueDate: toPrismaDateTime(rest.issueDate),
        }),
        ...(rest.expiryDate !== undefined && {
          expiryDate: toPrismaDateTime(rest.expiryDate),
        }),
        ...(rest.document !== undefined && {
          document: rest.document as Prisma.InputJsonValue,
        }),
      },
    });

    if (isAdmin) {
      this.notifyVehicleDocumentReviewOutcomeIfNeeded(
        driverId,
        VehicleDocumentKind.PCO_DOCUMENT,
        DocumentStatus.PENDING,
        doc,
      );
    }

    return formatResponse({
      success: true,
      data: doc,
      message: 'Vehicle PCO document created successfully',
    });
  }

  async updatePcoDoc(
    driverId: string,
    vehicleId: string,
    pcoDocId: string,
    dto: UpdateVehiclePcoDocumentDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehiclePcoDocument.findFirst({
      where: { id: pcoDocId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle PCO document not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    const { status, rejectedReason, ...rest } = dto;

    const data: Prisma.VehiclePcoDocumentUpdateInput = {};
    if (rest.badgeNumber !== undefined) data.badgeNumber = rest.badgeNumber;
    if (rest.issueDate !== undefined) {
      data.issueDate = toPrismaDateTime(rest.issueDate);
    }
    if (rest.expiryDate !== undefined) {
      data.expiryDate = toPrismaDateTime(rest.expiryDate);
    }
    if (rest.document !== undefined) {
      data.document = rest.document as Prisma.InputJsonValue;
    }
    applyDriverResubmissionReviewReset(
      isAdmin,
      existing.status,
      data,
      Object.keys(data).length > 0,
    );
    this.mergeAdminReviewFieldsOnUpdate(isAdmin, data, status, rejectedReason);

    const doc = await this.prisma.vehiclePcoDocument.update({
      where: { id: pcoDocId },
      data,
    });

    const [mapped] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.PCO_DOCUMENT,
      [doc],
    );

    if (isAdmin) {
      this.notifyVehicleDocumentReviewOutcomeIfNeeded(
        driverId,
        VehicleDocumentKind.PCO_DOCUMENT,
        existing.status,
        doc,
      );
    }

    return formatResponse({
      success: true,
      data: mapped,
      message: 'Vehicle PCO document updated successfully',
    });
  }

  async deletePcoDoc(
    driverId: string,
    vehicleId: string,
    pcoDocId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehiclePcoDocument.findFirst({
      where: { id: pcoDocId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle PCO document not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    await this.prisma.vehiclePcoDocument.delete({ where: { id: pcoDocId } });
    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle PCO document deleted successfully',
    });
  }

  // -----------------------
  // Log book V5
  // -----------------------
  async listLogBookV5(driverId: string, vehicleId: string, requester: Requester) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const rows = await this.prisma.logBookV5.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    const data = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.LOG_BOOK_V5,
      rows,
    );

    return formatResponse({
      success: true,
      data,
      message: 'Log book V5 documents retrieved successfully',
    });
  }

  async getLogBookV5(
    driverId: string,
    vehicleId: string,
    logBookV5Id: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const row = await this.prisma.logBookV5.findFirst({
      where: { id: logBookV5Id, vehicleId },
    });
    if (!row) throw new NotFoundException('Log book V5 not found');

    const [data] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.LOG_BOOK_V5,
      [row],
    );

    return formatResponse({
      success: true,
      data,
      message: 'Log book V5 retrieved successfully',
    });
  }

  async createLogBookV5(
    driverId: string,
    vehicleId: string,
    dto: CreateLogBookV5Dto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const row = await this.prisma.logBookV5.create({
      data: {
        vehicleId,
        document: dto.document as Prisma.InputJsonValue,
      },
    });

    return formatResponse({
      success: true,
      data: row,
      message: 'Log book V5 created successfully',
    });
  }

  async updateLogBookV5(
    driverId: string,
    vehicleId: string,
    logBookV5Id: string,
    dto: UpdateLogBookV5Dto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.logBookV5.findFirst({
      where: { id: logBookV5Id, vehicleId },
    });
    if (!existing) throw new NotFoundException('Log book V5 not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    const data: Prisma.LogBookV5UpdateInput = {};
    if (dto.document !== undefined) data.document = dto.document as Prisma.InputJsonValue;
    applyDriverResubmissionReviewReset(
      isAdmin,
      existing.status,
      data,
      dto.document !== undefined,
    );

    const row = await this.prisma.logBookV5.update({
      where: { id: logBookV5Id },
      data,
    });

    const [mapped] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.LOG_BOOK_V5,
      [row],
    );

    return formatResponse({
      success: true,
      data: mapped,
      message: 'Log book V5 updated successfully',
    });
  }

  async deleteLogBookV5(
    driverId: string,
    vehicleId: string,
    logBookV5Id: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.logBookV5.findFirst({
      where: { id: logBookV5Id, vehicleId },
    });
    if (!existing) throw new NotFoundException('Log book V5 not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    await this.prisma.logBookV5.delete({ where: { id: logBookV5Id } });

    return formatResponse({
      success: true,
      data: null,
      message: 'Log book V5 deleted successfully',
    });
  }

  async adminListLogBookV5(vehicleId: string) {
    await this.getVehicleOrThrow(vehicleId);
    const rows = await this.prisma.logBookV5.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });
    return formatResponse({
      success: true,
      data: rows,
      message: 'Log book V5 documents retrieved successfully',
    });
  }

  async adminGetLogBookV5(vehicleId: string, logBookV5Id: string) {
    await this.getVehicleOrThrow(vehicleId);
    const row = await this.prisma.logBookV5.findFirst({
      where: { id: logBookV5Id, vehicleId },
    });
    if (!row) throw new NotFoundException('Log book V5 not found');
    return formatResponse({
      success: true,
      data: row,
      message: 'Log book V5 retrieved successfully',
    });
  }

  async adminReviewLogBookV5(
    vehicleId: string,
    logBookV5Id: string,
    dto: AdminReviewLogBookV5Dto,
    requester: Requester,
  ) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    const vehicle = await this.getVehicleOrThrow(vehicleId);

    const existing = await this.prisma.logBookV5.findFirst({
      where: { id: logBookV5Id, vehicleId },
    });
    if (!existing) throw new NotFoundException('Log book V5 not found');

    const data: Prisma.LogBookV5UpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status as DocumentStatus;
    if (dto.rejectedReason !== undefined) data.rejectedReason = dto.rejectedReason;

    const row = await this.prisma.logBookV5.update({
      where: { id: logBookV5Id },
      data,
    });

    this.notifyVehicleDocumentReviewOutcomeIfNeeded(
      vehicle.driverId,
      VehicleDocumentKind.LOG_BOOK_V5,
      existing.status,
      row,
    );

    return formatResponse({
      success: true,
      data: row,
      message: 'Log book V5 reviewed successfully',
    });
  }

  // -----------------------
  // Permission letters
  // -----------------------
  async listPermissionLetters(driverId: string, vehicleId: string, requester: Requester) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const rows = await this.prisma.permissionLetter.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    const data = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.PERMISSION_LETTER,
      rows,
    );

    return formatResponse({
      success: true,
      data,
      message: 'Permission letters retrieved successfully',
    });
  }

  async getPermissionLetter(
    driverId: string,
    vehicleId: string,
    permissionLetterId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const row = await this.prisma.permissionLetter.findFirst({
      where: { id: permissionLetterId, vehicleId },
    });
    if (!row) throw new NotFoundException('Permission letter not found');

    const [data] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.PERMISSION_LETTER,
      [row],
    );

    return formatResponse({
      success: true,
      data,
      message: 'Permission letter retrieved successfully',
    });
  }

  async createPermissionLetter(
    driverId: string,
    vehicleId: string,
    dto: CreatePermissionLetterDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const row = await this.prisma.permissionLetter.create({
      data: {
        vehicleId,
        ...(dto.document !== undefined && { document: dto.document as Prisma.InputJsonValue }),
      },
    });

    return formatResponse({
      success: true,
      data: row,
      message: 'Permission letter created successfully',
    });
  }

  async updatePermissionLetter(
    driverId: string,
    vehicleId: string,
    permissionLetterId: string,
    dto: UpdatePermissionLetterDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.permissionLetter.findFirst({
      where: { id: permissionLetterId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Permission letter not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    const data: Prisma.PermissionLetterUpdateInput = {};
    if (dto.document !== undefined) data.document = dto.document as Prisma.InputJsonValue;
    applyDriverResubmissionReviewReset(
      isAdmin,
      existing.status,
      data,
      dto.document !== undefined,
    );

    const row = await this.prisma.permissionLetter.update({
      where: { id: permissionLetterId },
      data,
    });

    const [mapped] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.PERMISSION_LETTER,
      [row],
    );

    return formatResponse({
      success: true,
      data: mapped,
      message: 'Permission letter updated successfully',
    });
  }

  async deletePermissionLetter(
    driverId: string,
    vehicleId: string,
    permissionLetterId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.permissionLetter.findFirst({
      where: { id: permissionLetterId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Permission letter not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    await this.prisma.permissionLetter.delete({ where: { id: permissionLetterId } });

    return formatResponse({
      success: true,
      data: null,
      message: 'Permission letter deleted successfully',
    });
  }

  async adminListPermissionLetters(vehicleId: string) {
    await this.getVehicleOrThrow(vehicleId);
    const rows = await this.prisma.permissionLetter.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });
    return formatResponse({
      success: true,
      data: rows,
      message: 'Permission letters retrieved successfully',
    });
  }

  async adminGetPermissionLetter(vehicleId: string, permissionLetterId: string) {
    await this.getVehicleOrThrow(vehicleId);
    const row = await this.prisma.permissionLetter.findFirst({
      where: { id: permissionLetterId, vehicleId },
    });
    if (!row) throw new NotFoundException('Permission letter not found');
    return formatResponse({
      success: true,
      data: row,
      message: 'Permission letter retrieved successfully',
    });
  }

  async adminReviewPermissionLetter(
    vehicleId: string,
    permissionLetterId: string,
    dto: AdminReviewPermissionLetterDto,
    requester: Requester,
  ) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    const vehicle = await this.getVehicleOrThrow(vehicleId);

    const existing = await this.prisma.permissionLetter.findFirst({
      where: { id: permissionLetterId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Permission letter not found');

    const data: Prisma.PermissionLetterUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status as DocumentStatus;
    if (dto.rejectedReason !== undefined) data.rejectedReason = dto.rejectedReason;

    const row = await this.prisma.permissionLetter.update({
      where: { id: permissionLetterId },
      data,
    });

    this.notifyVehicleDocumentReviewOutcomeIfNeeded(
      vehicle.driverId,
      VehicleDocumentKind.PERMISSION_LETTER,
      existing.status,
      row,
    );

    if (row.status === DocumentStatus.ACCEPTED) {
      void this.maybeClearOptionalDocumentsRequest(vehicleId);
    }

    return formatResponse({
      success: true,
      data: row,
      message: 'Permission letter reviewed successfully',
    });
  }

  // -----------------------
  // Vehicle schedules
  // -----------------------
  async listVehicleSchedules(driverId: string, vehicleId: string, requester: Requester) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const rows = await this.prisma.vehicleSchedule.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    const data = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.SCHEDULE,
      rows,
    );

    return formatResponse({
      success: true,
      data,
      message: 'Vehicle schedules retrieved successfully',
    });
  }

  async getVehicleSchedule(
    driverId: string,
    vehicleId: string,
    scheduleId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const row = await this.prisma.vehicleSchedule.findFirst({
      where: { id: scheduleId, vehicleId },
    });
    if (!row) throw new NotFoundException('Vehicle schedule not found');

    const [data] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.SCHEDULE,
      [row],
    );

    return formatResponse({
      success: true,
      data,
      message: 'Vehicle schedule retrieved successfully',
    });
  }

  async createVehicleSchedule(
    driverId: string,
    vehicleId: string,
    dto: CreateVehicleScheduleDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const row = await this.prisma.vehicleSchedule.create({
      data: {
        vehicleId,
        ...(dto.document !== undefined && { document: dto.document as Prisma.InputJsonValue }),
      },
    });

    return formatResponse({
      success: true,
      data: row,
      message: 'Vehicle schedule created successfully',
    });
  }

  async updateVehicleSchedule(
    driverId: string,
    vehicleId: string,
    scheduleId: string,
    dto: UpdateVehicleScheduleDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleSchedule.findFirst({
      where: { id: scheduleId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle schedule not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    const data: Prisma.VehicleScheduleUpdateInput = {};
    if (dto.document !== undefined) data.document = dto.document as Prisma.InputJsonValue;
    applyDriverResubmissionReviewReset(
      isAdmin,
      existing.status,
      data,
      dto.document !== undefined,
    );

    const row = await this.prisma.vehicleSchedule.update({
      where: { id: scheduleId },
      data,
    });

    const [mapped] = await attachPendingToVehicleDocumentRows(
      this.prisma,
      VehicleDocumentKind.SCHEDULE,
      [row],
    );

    return formatResponse({
      success: true,
      data: mapped,
      message: 'Vehicle schedule updated successfully',
    });
  }

  async deleteVehicleSchedule(
    driverId: string,
    vehicleId: string,
    scheduleId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleSchedule.findFirst({
      where: { id: scheduleId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle schedule not found');

    const isAdmin = requester.role === 'ADMIN';
    assertDriverMayMutateLiveVehicleDocument(isAdmin, existing.status);

    await this.prisma.vehicleSchedule.delete({ where: { id: scheduleId } });

    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle schedule deleted successfully',
    });
  }

  async adminListVehicleSchedules(vehicleId: string) {
    await this.getVehicleOrThrow(vehicleId);
    const rows = await this.prisma.vehicleSchedule.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });
    return formatResponse({
      success: true,
      data: rows,
      message: 'Vehicle schedules retrieved successfully',
    });
  }

  async adminGetVehicleSchedule(vehicleId: string, scheduleId: string) {
    await this.getVehicleOrThrow(vehicleId);
    const row = await this.prisma.vehicleSchedule.findFirst({
      where: { id: scheduleId, vehicleId },
    });
    if (!row) throw new NotFoundException('Vehicle schedule not found');
    return formatResponse({
      success: true,
      data: row,
      message: 'Vehicle schedule retrieved successfully',
    });
  }

  async adminReviewVehicleSchedule(
    vehicleId: string,
    scheduleId: string,
    dto: AdminReviewVehicleScheduleDto,
    requester: Requester,
  ) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    const vehicle = await this.getVehicleOrThrow(vehicleId);

    const existing = await this.prisma.vehicleSchedule.findFirst({
      where: { id: scheduleId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle schedule not found');

    const data: Prisma.VehicleScheduleUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status as DocumentStatus;
    if (dto.rejectedReason !== undefined) data.rejectedReason = dto.rejectedReason;

    const row = await this.prisma.vehicleSchedule.update({
      where: { id: scheduleId },
      data,
    });

    this.notifyVehicleDocumentReviewOutcomeIfNeeded(
      vehicle.driverId,
      VehicleDocumentKind.SCHEDULE,
      existing.status,
      row,
    );

    if (row.status === DocumentStatus.ACCEPTED) {
      void this.maybeClearOptionalDocumentsRequest(vehicleId);
    }

    return formatResponse({
      success: true,
      data: row,
      message: 'Vehicle schedule reviewed successfully',
    });
  }

  async getDriverVehicleDocumentStatus(
    driverId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    return this.getInternalDriverVehicleDocumentStatus(driverId);
  }

  /** Internal: document review statuses for all vehicles owned by a driver. */
  async getInternalDriverVehicleDocumentStatus(driverId: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        isApproved: true,
        requiestOptionalDocuments: true,
        logBookV5: {
          select: {
            id: true,
            status: true,
            rejectedReason: true,
            updatedAt: true,
          },
        },
        inspections: {
          select: {
            id: true,
            status: true,
            rejectedReason: true,
            inspectionType: true,
            updatedAt: true,
          },
        },
        insurances: {
          select: {
            id: true,
            status: true,
            rejectedReason: true,
            provider: true,
            updatedAt: true,
          },
        },
        pcoDocs: {
          select: {
            id: true,
            status: true,
            rejectedReason: true,
            badgeNumber: true,
            updatedAt: true,
          },
        },
        permissionLetters: {
          select: {
            id: true,
            status: true,
            rejectedReason: true,
            updatedAt: true,
          },
        },
        vehicleSchedules: {
          select: {
            id: true,
            status: true,
            rejectedReason: true,
            updatedAt: true,
          },
        },
      },
    });

    const mapDoc = (
      row: {
        id: string;
        status: DocumentStatus;
        rejectedReason: string | null;
        updatedAt: Date;
      },
      label?: string | null,
    ) => ({
      id: row.id,
      status: row.status,
      reviewStatus: normalizeToReviewStatus(row.status),
      rejectedReason: row.rejectedReason,
      label: label ?? null,
      updatedAt: row.updatedAt.toISOString(),
    });

    const mappedVehicles = vehicles.map((v) => ({
      vehicleId: v.id,
      plateNumber: v.plateNumber,
      make: v.make,
      model: v.model,
      isApproved: v.isApproved,
      requiestOptionalDocuments: v.requiestOptionalDocuments,
      logBookV5: v.logBookV5.map((d) => mapDoc(d)),
      inspections: v.inspections.map((i) =>
        mapDoc(i, i.inspectionType ?? null),
      ),
      insurances: v.insurances.map((i) => mapDoc(i, i.provider ?? null)),
      pcoDocs: v.pcoDocs.map((d) => mapDoc(d, d.badgeNumber ?? null)),
      permissionLetters: v.permissionLetters.map((p) => mapDoc(p)),
      vehicleSchedules: v.vehicleSchedules.map((s) => mapDoc(s)),
    }));

    return formatResponse({
      success: true,
      data: {
        driverId,
        vehicles: mappedVehicles,
      },
      message: 'Driver vehicle document status retrieved successfully',
    });
  }

  /** Internal: expired and soon-to-expire accepted vehicle documents for a driver. */
  async getInternalDriverDocumentExpiry(
    driverId: string,
    horizonDays = 7,
    reference = new Date(),
  ) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        inspections: {
          where: {
            status: DocumentStatus.ACCEPTED,
            expiryDate: { not: null },
          },
          select: {
            id: true,
            status: true,
            inspectionType: true,
            expiryDate: true,
          },
        },
        insurances: {
          where: {
            status: DocumentStatus.ACCEPTED,
            endDate: { not: null },
          },
          select: {
            id: true,
            status: true,
            provider: true,
            endDate: true,
          },
        },
        pcoDocs: {
          where: {
            status: DocumentStatus.ACCEPTED,
            expiryDate: { not: null },
          },
          select: {
            id: true,
            status: true,
            badgeNumber: true,
            expiryDate: true,
          },
        },
      },
    });

    const expired: DocumentExpiryItem[] = [];
    const expiringSoon: DocumentExpiryItem[] = [];

    for (const vehicle of vehicles) {
      const vehicleLabel =
        [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim() ||
        vehicle.plateNumber;

      for (const inspection of vehicle.inspections) {
        const expiry = inspection.expiryDate!;
        const bucket = classifyExpiryBucket(expiry, reference, horizonDays);
        if (!bucket) continue;

        const item: DocumentExpiryItem = {
          scope: 'VEHICLE',
          documentType: 'VEHICLE_INSPECTION',
          documentId: inspection.id,
          label: inspection.inspectionType
            ? `${inspection.inspectionType} Inspection`
            : 'Vehicle Inspection',
          expiryDate: expiry.toISOString(),
          daysUntilExpiry: daysUntilExpiry(expiry, reference),
          reviewStatus: 'ACCEPTED',
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          vehicleLabel,
          inspectionType: inspection.inspectionType,
        };

        if (bucket === 'expired') expired.push(item);
        else expiringSoon.push(item);
      }

      for (const insurance of vehicle.insurances) {
        const expiry = insurance.endDate!;
        const bucket = classifyExpiryBucket(expiry, reference, horizonDays);
        if (!bucket) continue;

        const item: DocumentExpiryItem = {
          scope: 'VEHICLE',
          documentType: 'VEHICLE_INSURANCE',
          documentId: insurance.id,
          label: insurance.provider
            ? `${insurance.provider} Insurance`
            : 'Vehicle Insurance',
          expiryDate: expiry.toISOString(),
          daysUntilExpiry: daysUntilExpiry(expiry, reference),
          reviewStatus: 'ACCEPTED',
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          vehicleLabel,
        };

        if (bucket === 'expired') expired.push(item);
        else expiringSoon.push(item);
      }

      for (const pcoDoc of vehicle.pcoDocs) {
        const expiry = pcoDoc.expiryDate!;
        const bucket = classifyExpiryBucket(expiry, reference, horizonDays);
        if (!bucket) continue;

        const item: DocumentExpiryItem = {
          scope: 'VEHICLE',
          documentType: 'VEHICLE_PCO',
          documentId: pcoDoc.id,
          label: pcoDoc.badgeNumber
            ? `Vehicle PCO (${pcoDoc.badgeNumber})`
            : 'Vehicle PCO',
          expiryDate: expiry.toISOString(),
          daysUntilExpiry: daysUntilExpiry(expiry, reference),
          reviewStatus: 'ACCEPTED',
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          vehicleLabel,
        };

        if (bucket === 'expired') expired.push(item);
        else expiringSoon.push(item);
      }
    }

    return formatResponse({
      success: true,
      data: {
        driverId,
        horizonDays,
        expired: sortByDaysUntilExpiry(expired),
        expiringSoon: sortByDaysUntilExpiry(expiringSoon),
      },
      message: 'Driver vehicle document expiry retrieved successfully',
    });
  }

  /** Internal: driver user IDs with at least one expired accepted vehicle document. */
  async getInternalExpiredDocumentDriverIds(reference = new Date()) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: this.buildVehicleExpiredDocumentWhere(reference),
      select: { driverId: true },
      distinct: ['driverId'],
    });

    const driverIds = vehicles.map((v) => v.driverId);

    return formatResponse({
      success: true,
      data: { driverIds },
      message: 'Drivers with expired vehicle documents retrieved successfully',
    });
  }
}

