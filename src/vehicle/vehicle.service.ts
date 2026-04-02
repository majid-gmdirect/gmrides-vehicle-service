import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Prisma, InspectionType } from '@prisma/client';
import { lastValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { formatResponse } from '../common/format-response.util';
import {
  CreateVehicleDto,
  CreateVehicleImageDto,
  CreateVehicleInspectionDto,
  CreateVehicleInsuranceDto,
  CreateVehiclePcoDocumentDto,
  ListVehiclesQueryDto,
  UpdateVehicleActiveDto,
  UpdateVehicleApprovedDto,
  UpdateVehicleDto,
  UpdateVehicleInspectionDto,
  UpdateVehicleInsuranceDto,
  UpdateVehiclePcoDocumentDto,
} from './dto';

type Requester = { userId: string; role?: string };

function toPrismaDateTime(value: string): Date {
  if (value.includes('T')) return new Date(value);
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class VehicleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

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

    return formatResponse({
      success: true,
      data: vehicles,
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

    return formatResponse({
      success: true,
      data: vehicle,
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
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const data: Prisma.VehicleUpdateInput = {};
    if (dto.make !== undefined) data.make = dto.make.trim();
    if (dto.model !== undefined) data.model = dto.model.trim();
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.color !== undefined) data.color = dto.color?.trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

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

    return formatResponse({
      success: true,
      data: vehicle,
      message: 'Vehicle updated successfully',
    });
  }

  async deleteVehicle(driverId: string, vehicleId: string, requester: Requester) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    await this.prisma.vehicle.delete({ where: { id: vehicleId } });

    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle deleted successfully',
    });
  }

  async adminListVehicles(query: ListVehiclesQueryDto) {
    const {
      search,
      page = 1,
      limit = 10,
      orderBy = 'desc',
      isActive,
      isApproved,
    } = query;
    const skip = (page - 1) * limit;

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
          inspections: true,
          insurances: true,
          pcoDocs: true,
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
    await this.getVehicleOrThrow(vehicleId);

    const vehicle = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isApproved: dto.isApproved },
    });

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

  // -----------------------
  // Images
  // -----------------------
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
  async createInspection(
    driverId: string,
    vehicleId: string,
    dto: CreateVehicleInspectionDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const inspectionType = dto.inspectionType as InspectionType;

    const inspection = await this.prisma.vehicleInspection.create({
      data: {
        vehicleId,
        inspectionType,
        inspectionDate: toPrismaDateTime(dto.inspectionDate),
        ...(dto.expiryDate !== undefined && {
          expiryDate: toPrismaDateTime(dto.expiryDate),
        }),
        ...(dto.document !== undefined && {
          document: dto.document as Prisma.InputJsonValue,
        }),
      },
    });

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

    const data: Prisma.VehicleInspectionUpdateInput = {};
    if (dto.inspectionType !== undefined) {
      data.inspectionType = dto.inspectionType as InspectionType;
    }
    if (dto.inspectionDate !== undefined) {
      data.inspectionDate = toPrismaDateTime(dto.inspectionDate);
    }
    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate ? toPrismaDateTime(dto.expiryDate) : null;
    }
    if (dto.document !== undefined) {
      data.document = dto.document as Prisma.InputJsonValue;
    }

    const inspection = await this.prisma.vehicleInspection.update({
      where: { id: inspectionId },
      data,
    });

    return formatResponse({
      success: true,
      data: inspection,
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
  async createInsurance(
    driverId: string,
    vehicleId: string,
    dto: CreateVehicleInsuranceDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const insurance = await this.prisma.vehicleInsurance.create({
      data: {
        vehicleId,
        provider: dto.provider,
        policyNumber: dto.policyNumber,
        startDate: toPrismaDateTime(dto.startDate),
        ...(dto.endDate !== undefined && { endDate: toPrismaDateTime(dto.endDate) }),
        ...(dto.document !== undefined && {
          document: dto.document as Prisma.InputJsonValue,
        }),
      },
    });

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

    const data: Prisma.VehicleInsuranceUpdateInput = {};
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.policyNumber !== undefined) data.policyNumber = dto.policyNumber;
    if (dto.startDate !== undefined) data.startDate = toPrismaDateTime(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? toPrismaDateTime(dto.endDate) : null;
    if (dto.document !== undefined)
      data.document = dto.document as Prisma.InputJsonValue;

    const insurance = await this.prisma.vehicleInsurance.update({
      where: { id: insuranceId },
      data,
    });

    return formatResponse({
      success: true,
      data: insurance,
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
  async createPcoDoc(
    driverId: string,
    vehicleId: string,
    dto: CreateVehiclePcoDocumentDto,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.assertDriverExistsAndIsDriver(driverId);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const doc = await this.prisma.vehiclePcoDocument.create({
      data: {
        vehicleId,
        ...(dto.badgeNumber !== undefined && { badgeNumber: dto.badgeNumber }),
        issueDate: toPrismaDateTime(dto.issueDate),
        expiryDate: toPrismaDateTime(dto.expiryDate),
        ...(dto.document !== undefined && {
          document: dto.document as Prisma.InputJsonValue,
        }),
      },
    });

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

    const data: Prisma.VehiclePcoDocumentUpdateInput = {};
    if (dto.badgeNumber !== undefined) data.badgeNumber = dto.badgeNumber;
    if (dto.issueDate !== undefined) data.issueDate = toPrismaDateTime(dto.issueDate);
    if (dto.expiryDate !== undefined) data.expiryDate = toPrismaDateTime(dto.expiryDate);
    if (dto.document !== undefined) data.document = dto.document as Prisma.InputJsonValue;

    const doc = await this.prisma.vehiclePcoDocument.update({
      where: { id: pcoDocId },
      data,
    });

    return formatResponse({
      success: true,
      data: doc,
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

    await this.prisma.vehiclePcoDocument.delete({ where: { id: pcoDocId } });
    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle PCO document deleted successfully',
    });
  }
}

