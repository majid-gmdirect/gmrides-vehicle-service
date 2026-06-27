import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import {
  DocumentStatus,
  Prisma,
  VehicleDocumentChangeRequestStatus,
  VehicleDocumentKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatResponse } from '../../common/format-response.util';
import {
  buildDocumentOnlyChangePayload,
  buildStoredInspectionChangePayload,
  buildInsuranceChangePayload,
  buildPcoDocumentChangePayload,
  DocumentOnlyChangePayload,
  documentOnlyChangePayloadDiffers,
  documentOnlyPayloadToPrismaUpdate,
  inspectionPayloadToPartialPrismaUpdate,
  inspectionPayloadToPrismaUpdate,
  parseInspectionStoredPayload,
  InsuranceChangePayload,
  insuranceChangePayloadDiffers,
  insurancePayloadToPrismaUpdate,
  mapChangePayloadForResponse,
  PcoDocumentChangePayload,
  pcoDocumentChangePayloadDiffers,
  pcoDocumentPayloadToPrismaUpdate,
  VehicleDocumentChangePayload,
  vehicleDocumentKindLabel,
} from '../../common/vehicle-document-change-payload.util';
import { notifyAdminsVehicleDocumentChangeRequestSubmitted } from '../../common/vehicle-document-change-request-notification.util';
import { tryNotifyDriverVehicleDocumentChangeRequestReviewed } from '../../common/vehicle-document-driver-notification.util';
import { lastValueFrom } from 'rxjs';
import {
  AdminListAllVehicleDocumentChangeRequestsDto,
  AdminQueryVehicleDocumentChangeRequestsDto,
  AdminReviewVehicleDocumentChangeRequestDto,
  SubmitDocumentOnlyChangeRequestDto,
  SubmitVehicleInspectionChangeRequestDto,
  SubmitVehicleInsuranceChangeRequestDto,
  SubmitVehiclePcoChangeRequestDto,
} from './dto';

type Requester = { userId: string; role?: string };

@Injectable()
export class VehicleDocumentChangeRequestService {
  private readonly logger = new Logger(VehicleDocumentChangeRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  private assertDriverAccess(driverId: string, requester: Requester): void {
    const isOwner = driverId === requester.userId;
    const isAdmin = requester.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to access this driver vehicles',
      );
    }
  }

  private async getVehicleForDriverOrThrow(
    driverId: string,
    vehicleId: string,
  ) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, driverId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  private mapChangeRequestRow(row: {
    id: string;
    driverId: string;
    vehicleId: string;
    targetType: VehicleDocumentKind;
    targetDocumentId: string;
    status: VehicleDocumentChangeRequestStatus;
    payload: unknown;
    driver_note: string | null;
    rejected_reason: string | null;
    reviewed_by_id: string | null;
    reviewed_at: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      driverId: row.driverId,
      vehicleId: row.vehicleId,
      targetType: row.targetType,
      targetDocumentId: row.targetDocumentId,
      status: row.status,
      payload: mapChangePayloadForResponse(
        row.targetType,
        row.payload as VehicleDocumentChangePayload,
      ),
      driver_note: row.driver_note,
      rejected_reason: row.rejected_reason,
      reviewed_by_id: row.reviewed_by_id,
      reviewed_at: row.reviewed_at?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private formatDriverDisplayName(driver: {
    firstName?: string | null;
    lastName?: string | null;
    id?: string;
  } | null): string {
    if (!driver) return 'Driver';
    const name = [driver.firstName, driver.lastName]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim();
    return name || driver.id || 'Driver';
  }

  private formatVehicleDisplayName(vehicle: {
    make: string;
    model: string;
    plateNumber: string;
  }): string {
    return `${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})`;
  }

  private toPublicDriverShape(input: any) {
    if (!input) return null;
    const user = input?.user;
    const userId = input?.userId ?? user?.id;
    const firstName = user?.first_name ?? input?.firstName ?? null;
    const lastName = user?.last_name ?? input?.lastName ?? null;
    const email = user?.email ?? input?.email ?? null;

    if (!userId && !firstName && !lastName && !email) return null;

    return {
      id: userId,
      firstName,
      lastName,
      email,
      displayName: this.formatDriverDisplayName({
        id: userId,
        firstName,
        lastName,
      }),
    };
  }

  private mapChangeRequestSummaryRow(
    row: {
      id: string;
      driverId: string;
      vehicleId: string;
      targetType: VehicleDocumentKind;
      targetDocumentId: string;
      status: VehicleDocumentChangeRequestStatus;
      driver_note: string | null;
      createdAt: Date;
      updatedAt: Date;
      vehicle: {
        id: string;
        make: string;
        model: string;
        plateNumber: string;
      };
    },
    driverInput: any,
  ) {
    const driver = this.toPublicDriverShape(driverInput);
    const targetTypeLabel = vehicleDocumentKindLabel(row.targetType);
    const vehicle = {
      id: row.vehicle.id,
      make: row.vehicle.make,
      model: row.vehicle.model,
      plateNumber: row.vehicle.plateNumber,
      displayName: this.formatVehicleDisplayName(row.vehicle),
    };

    return {
      id: row.id,
      status: row.status,
      targetType: row.targetType,
      targetTypeLabel,
      targetDocumentId: row.targetDocumentId,
      driverId: row.driverId,
      driver,
      vehicleId: row.vehicleId,
      vehicle,
      driver_note: row.driver_note,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async fetchDriverIdsByName(search: string): Promise<string[]> {
    const baseUrl = process.env.BASE_API_URL;
    if (!baseUrl || !process.env.INTERNAL_API_KEY) return [];

    const q = search.trim();
    if (!q) return [];

    try {
      const headers = {
        Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
      };

      const fetchIds = async (term: string): Promise<string[]> => {
        try {
          const res = await lastValueFrom(
            this.httpService.get(`${baseUrl}/api/users/main/internal/driver-ids`, {
              headers,
              params: { search: term },
            }),
          );
          const ids: unknown[] = res?.data?.ids ?? [];
          return ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
        } catch (e: any) {
          const status = e?.response?.status;
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
              // fall through
            }
          }
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

      const terms = q.split(/\s+/).filter(Boolean);
      const fullMatchIds = await fetchIds(q);
      if (terms.length <= 1) {
        return Array.from(new Set(fullMatchIds));
      }

      const perTerm = await Promise.all(terms.map((t) => fetchIds(t)));
      const sets = perTerm.map((arr) => new Set(arr));
      const intersection = perTerm[0].filter((id) => sets.every((s) => s.has(id)));
      const union = Array.from(new Set([...fullMatchIds, ...perTerm.flat()]));
      return intersection.length ? Array.from(new Set(intersection)) : union;
    } catch {
      return [];
    }
  }

  private async fetchDriversByIds(driverIds: string[]) {
    const baseUrl = process.env.BASE_API_URL;
    if (!baseUrl || !process.env.INTERNAL_API_KEY) {
      return new Map<string, any>();
    }

    const ids = Array.from(new Set(driverIds.filter(Boolean)));
    if (ids.length === 0) return new Map<string, any>();

    try {
      const headers = {
        Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
      };

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

      return map;
    } catch {
      return new Map<string, any>();
    }
  }

  private async assertAcceptedTarget(
    targetType: VehicleDocumentKind,
    targetDocumentId: string,
    vehicleId: string,
  ): Promise<void> {
    const status = await this.getTargetDocumentStatus(
      targetType,
      targetDocumentId,
      vehicleId,
    );
    if (status === null) {
      throw new NotFoundException('Target vehicle document not found');
    }
    if (status !== DocumentStatus.ACCEPTED) {
      throw new BadRequestException(
        'Change requests are only available for accepted documents. Update the document directly instead.',
      );
    }
  }

  private async getTargetDocumentStatus(
    targetType: VehicleDocumentKind,
    targetDocumentId: string,
    vehicleId: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<DocumentStatus | null> {
    switch (targetType) {
      case VehicleDocumentKind.INSPECTION: {
        const row = await db.vehicleInspection.findFirst({
          where: { id: targetDocumentId, vehicleId },
          select: { status: true },
        });
        return row?.status ?? null;
      }
      case VehicleDocumentKind.INSURANCE: {
        const row = await db.vehicleInsurance.findFirst({
          where: { id: targetDocumentId, vehicleId },
          select: { status: true },
        });
        return row?.status ?? null;
      }
      case VehicleDocumentKind.PCO_DOCUMENT: {
        const row = await db.vehiclePcoDocument.findFirst({
          where: { id: targetDocumentId, vehicleId },
          select: { status: true },
        });
        return row?.status ?? null;
      }
      case VehicleDocumentKind.PERMISSION_LETTER: {
        const row = await db.permissionLetter.findFirst({
          where: { id: targetDocumentId, vehicleId },
          select: { status: true },
        });
        return row?.status ?? null;
      }
      case VehicleDocumentKind.SCHEDULE: {
        const row = await db.vehicleSchedule.findFirst({
          where: { id: targetDocumentId, vehicleId },
          select: { status: true },
        });
        return row?.status ?? null;
      }
      case VehicleDocumentKind.LOG_BOOK_V5: {
        const row = await db.logBookV5.findFirst({
          where: { id: targetDocumentId, vehicleId },
          select: { status: true },
        });
        return row?.status ?? null;
      }
      default:
        return null;
    }
  }

  private async createChangeRequest(params: {
    driverId: string;
    vehicleId: string;
    targetType: VehicleDocumentKind;
    targetDocumentId: string;
    payload: VehicleDocumentChangePayload;
    driver_note?: string;
  }) {
    const existingPending =
      await this.prisma.vehicleDocumentChangeRequest.findFirst({
        where: {
          targetType: params.targetType,
          targetDocumentId: params.targetDocumentId,
          status: VehicleDocumentChangeRequestStatus.PENDING_REVIEW,
        },
      });
    if (existingPending) {
      throw new ConflictException(
        'A change request is already pending review for this document',
      );
    }

    const row = await this.prisma.vehicleDocumentChangeRequest.create({
      data: {
        driverId: params.driverId,
        vehicleId: params.vehicleId,
        targetType: params.targetType,
        targetDocumentId: params.targetDocumentId,
        payload: params.payload as unknown as Prisma.InputJsonValue,
        driver_note: params.driver_note ?? null,
      },
    });

    await notifyAdminsVehicleDocumentChangeRequestSubmitted(
      this.httpService,
      this.notificationClient,
      this.logger,
      {
        driverUserId: params.driverId,
        vehicleId: params.vehicleId,
        targetType: params.targetType,
      },
    );

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(row),
      message: 'Vehicle document change request submitted successfully',
    });
  }

  async submitInspection(
    driverId: string,
    vehicleId: string,
    inspectionId: string,
    dto: SubmitVehicleInspectionChangeRequestDto,
    requester: Requester,
  ) {
    if (requester.role === 'ADMIN') {
      throw new ForbiddenException(
        'Admins cannot submit change requests; update the live document directly',
      );
    }
    this.assertDriverAccess(driverId, requester);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleInspection.findFirst({
      where: { id: inspectionId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle inspection not found');
    await this.assertAcceptedTarget(
      VehicleDocumentKind.INSPECTION,
      inspectionId,
      vehicleId,
    );

    const { driver_note, ...fields } = dto;
    const payload = buildStoredInspectionChangePayload(existing, fields);
    if (payload.changedFields.length === 0) {
      throw new BadRequestException('No changes detected in the change request');
    }

    return this.createChangeRequest({
      driverId,
      vehicleId,
      targetType: VehicleDocumentKind.INSPECTION,
      targetDocumentId: inspectionId,
      payload,
      driver_note,
    });
  }

  async submitInsurance(
    driverId: string,
    vehicleId: string,
    insuranceId: string,
    dto: SubmitVehicleInsuranceChangeRequestDto,
    requester: Requester,
  ) {
    if (requester.role === 'ADMIN') {
      throw new ForbiddenException(
        'Admins cannot submit change requests; update the live document directly',
      );
    }
    this.assertDriverAccess(driverId, requester);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleInsurance.findFirst({
      where: { id: insuranceId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle insurance not found');
    await this.assertAcceptedTarget(
      VehicleDocumentKind.INSURANCE,
      insuranceId,
      vehicleId,
    );

    const { driver_note, ...fields } = dto;
    const payload = buildInsuranceChangePayload(existing, fields);
    if (!insuranceChangePayloadDiffers(payload, existing)) {
      throw new BadRequestException('No changes detected in the change request');
    }

    return this.createChangeRequest({
      driverId,
      vehicleId,
      targetType: VehicleDocumentKind.INSURANCE,
      targetDocumentId: insuranceId,
      payload,
      driver_note,
    });
  }

  async submitPcoDoc(
    driverId: string,
    vehicleId: string,
    pcoDocId: string,
    dto: SubmitVehiclePcoChangeRequestDto,
    requester: Requester,
  ) {
    if (requester.role === 'ADMIN') {
      throw new ForbiddenException(
        'Admins cannot submit change requests; update the live document directly',
      );
    }
    this.assertDriverAccess(driverId, requester);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehiclePcoDocument.findFirst({
      where: { id: pcoDocId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle PCO document not found');
    await this.assertAcceptedTarget(
      VehicleDocumentKind.PCO_DOCUMENT,
      pcoDocId,
      vehicleId,
    );

    const { driver_note, ...fields } = dto;
    const payload = buildPcoDocumentChangePayload(existing, fields);
    if (!pcoDocumentChangePayloadDiffers(payload, existing)) {
      throw new BadRequestException('No changes detected in the change request');
    }

    return this.createChangeRequest({
      driverId,
      vehicleId,
      targetType: VehicleDocumentKind.PCO_DOCUMENT,
      targetDocumentId: pcoDocId,
      payload,
      driver_note,
    });
  }

  async submitPermissionLetter(
    driverId: string,
    vehicleId: string,
    permissionLetterId: string,
    dto: SubmitDocumentOnlyChangeRequestDto,
    requester: Requester,
  ) {
    if (requester.role === 'ADMIN') {
      throw new ForbiddenException(
        'Admins cannot submit change requests; update the live document directly',
      );
    }
    this.assertDriverAccess(driverId, requester);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.permissionLetter.findFirst({
      where: { id: permissionLetterId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Permission letter not found');
    await this.assertAcceptedTarget(
      VehicleDocumentKind.PERMISSION_LETTER,
      permissionLetterId,
      vehicleId,
    );

    const payload = buildDocumentOnlyChangePayload(existing, dto);
    if (!documentOnlyChangePayloadDiffers(payload, existing)) {
      throw new BadRequestException('No changes detected in the change request');
    }

    return this.createChangeRequest({
      driverId,
      vehicleId,
      targetType: VehicleDocumentKind.PERMISSION_LETTER,
      targetDocumentId: permissionLetterId,
      payload,
      driver_note: dto.driver_note,
    });
  }

  async submitSchedule(
    driverId: string,
    vehicleId: string,
    scheduleId: string,
    dto: SubmitDocumentOnlyChangeRequestDto,
    requester: Requester,
  ) {
    if (requester.role === 'ADMIN') {
      throw new ForbiddenException(
        'Admins cannot submit change requests; update the live document directly',
      );
    }
    this.assertDriverAccess(driverId, requester);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.vehicleSchedule.findFirst({
      where: { id: scheduleId, vehicleId },
    });
    if (!existing) throw new NotFoundException('Vehicle schedule not found');
    await this.assertAcceptedTarget(
      VehicleDocumentKind.SCHEDULE,
      scheduleId,
      vehicleId,
    );

    const payload = buildDocumentOnlyChangePayload(existing, dto);
    if (!documentOnlyChangePayloadDiffers(payload, existing)) {
      throw new BadRequestException('No changes detected in the change request');
    }

    return this.createChangeRequest({
      driverId,
      vehicleId,
      targetType: VehicleDocumentKind.SCHEDULE,
      targetDocumentId: scheduleId,
      payload,
      driver_note: dto.driver_note,
    });
  }

  async submitLogBookV5(
    driverId: string,
    vehicleId: string,
    logBookV5Id: string,
    dto: SubmitDocumentOnlyChangeRequestDto,
    requester: Requester,
  ) {
    if (requester.role === 'ADMIN') {
      throw new ForbiddenException(
        'Admins cannot submit change requests; update the live document directly',
      );
    }
    this.assertDriverAccess(driverId, requester);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const existing = await this.prisma.logBookV5.findFirst({
      where: { id: logBookV5Id, vehicleId },
    });
    if (!existing) throw new NotFoundException('Log book V5 not found');
    await this.assertAcceptedTarget(
      VehicleDocumentKind.LOG_BOOK_V5,
      logBookV5Id,
      vehicleId,
    );

    const payload = buildDocumentOnlyChangePayload(existing, dto);
    if (!documentOnlyChangePayloadDiffers(payload, existing)) {
      throw new BadRequestException('No changes detected in the change request');
    }

    return this.createChangeRequest({
      driverId,
      vehicleId,
      targetType: VehicleDocumentKind.LOG_BOOK_V5,
      targetDocumentId: logBookV5Id,
      payload,
      driver_note: dto.driver_note,
    });
  }

  async listForDocument(
    driverId: string,
    vehicleId: string,
    targetType: VehicleDocumentKind,
    targetDocumentId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const status = await this.getTargetDocumentStatus(
      targetType,
      targetDocumentId,
      vehicleId,
    );
    if (status === null) {
      throw new NotFoundException('Target vehicle document not found');
    }

    const rows = await this.prisma.vehicleDocumentChangeRequest.findMany({
      where: {
        driverId,
        vehicleId,
        targetType,
        targetDocumentId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return formatResponse({
      success: true,
      data: rows.map((row) => this.mapChangeRequestRow(row)),
      message: 'Vehicle document change requests retrieved successfully',
    });
  }

  async findOne(driverId: string, requestId: string, requester: Requester) {
    this.assertDriverAccess(driverId, requester);

    const row = await this.prisma.vehicleDocumentChangeRequest.findFirst({
      where: { id: requestId, driverId },
    });
    if (!row) throw new NotFoundException('Change request not found');

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(row),
      message: 'Vehicle document change request retrieved successfully',
    });
  }

  async cancel(driverId: string, requestId: string, requester: Requester) {
    if (requester.role === 'ADMIN') {
      throw new ForbiddenException(
        'Only the driver may cancel their change request',
      );
    }
    this.assertDriverAccess(driverId, requester);

    const row = await this.prisma.vehicleDocumentChangeRequest.findFirst({
      where: { id: requestId, driverId },
    });
    if (!row) throw new NotFoundException('Change request not found');
    if (row.status !== VehicleDocumentChangeRequestStatus.PENDING_REVIEW) {
      throw new ConflictException('Only pending change requests can be cancelled');
    }

    const updated = await this.prisma.vehicleDocumentChangeRequest.update({
      where: { id: requestId },
      data: { status: VehicleDocumentChangeRequestStatus.CANCELLED },
    });

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(updated),
      message: 'Vehicle document change request cancelled successfully',
    });
  }

  async adminListForVehicle(
    vehicleId: string,
    query: AdminQueryVehicleDocumentChangeRequestsDto,
    requester: Requester,
  ) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const where: Prisma.VehicleDocumentChangeRequestWhereInput = {
      vehicleId,
      ...(query.status !== undefined && { status: query.status }),
      ...(query.targetType !== undefined && { targetType: query.targetType }),
    };

    const rows = await this.prisma.vehicleDocumentChangeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return formatResponse({
      success: true,
      data: rows.map((row) => this.mapChangeRequestRow(row)),
      message: 'Vehicle document change requests retrieved successfully',
    });
  }

  async adminListForDriver(
    driverId: string,
    query: AdminQueryVehicleDocumentChangeRequestsDto,
    requester: Requester,
  ) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const where: Prisma.VehicleDocumentChangeRequestWhereInput = {
      driverId,
      ...(query.status !== undefined && { status: query.status }),
      ...(query.targetType !== undefined && { targetType: query.targetType }),
    };

    const rows = await this.prisma.vehicleDocumentChangeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return formatResponse({
      success: true,
      data: rows.map((row) => this.mapChangeRequestRow(row)),
      message: 'Vehicle document change requests retrieved successfully',
    });
  }

  async adminListAll(
    query: AdminListAllVehicleDocumentChangeRequestsDto,
    requester: Requester,
  ) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const {
      search,
      page = 1,
      limit = 10,
      orderBy = 'desc',
      status,
      targetType,
    } = query;
    const skip = (page - 1) * limit;

    const where = await this.buildAdminListWhere({ search, status, targetType });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vehicleDocumentChangeRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: orderBy },
        include: {
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              plateNumber: true,
            },
          },
        },
      }),
      this.prisma.vehicleDocumentChangeRequest.count({ where }),
    ]);

    const driverMap = await this.fetchDriversByIds(rows.map((row) => row.driverId));
    const data = rows.map((row) =>
      this.mapChangeRequestSummaryRow(row, driverMap.get(row.driverId)),
    );

    return formatResponse({
      success: true,
      data,
      paginationMeta: { total, page, limit },
      message: 'Vehicle document change requests retrieved successfully',
    });
  }

  async internalListAllSummaries(query: {
    status?: VehicleDocumentChangeRequestStatus;
    targetType?: VehicleDocumentKind;
  }) {
    const where = this.buildInternalListWhere(query);

    const rows = await this.prisma.vehicleDocumentChangeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            plateNumber: true,
          },
        },
      },
    });

    const driverMap = await this.fetchDriversByIds(rows.map((row) => row.driverId));
    return rows.map((row) =>
      this.mapChangeRequestSummaryRow(row, driverMap.get(row.driverId)),
    );
  }

  private async buildAdminListWhere(params: {
    search?: string;
    status?: VehicleDocumentChangeRequestStatus;
    targetType?: VehicleDocumentKind;
  }): Promise<Prisma.VehicleDocumentChangeRequestWhereInput> {
    const where: Prisma.VehicleDocumentChangeRequestWhereInput = {
      ...(params.status !== undefined && { status: params.status }),
      ...(params.targetType !== undefined && { targetType: params.targetType }),
    };

    if (params.search?.trim()) {
      const term = params.search.trim();
      const driverIds = await this.fetchDriverIdsByName(term);
      const vehicleOr: Prisma.VehicleWhereInput[] = [
        {
          plateNumber: {
            contains: term,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        { make: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { model: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { driverId: { contains: term, mode: Prisma.QueryMode.insensitive } },
      ];
      if (driverIds.length) {
        vehicleOr.push({ driverId: { in: driverIds } });
      }
      where.vehicle = { OR: vehicleOr };
    }

    return where;
  }

  private buildInternalListWhere(params: {
    status?: VehicleDocumentChangeRequestStatus;
    targetType?: VehicleDocumentKind;
  }): Prisma.VehicleDocumentChangeRequestWhereInput {
    return {
      ...(params.status !== undefined && { status: params.status }),
      ...(params.targetType !== undefined && { targetType: params.targetType }),
    };
  }

  async adminFindOne(requestId: string, requester: Requester) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const row = await this.prisma.vehicleDocumentChangeRequest.findUnique({
      where: { id: requestId },
    });
    if (!row) throw new NotFoundException('Change request not found');

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(row),
      message: 'Vehicle document change request retrieved successfully',
    });
  }

  private async applyAcceptedPayload(
    tx: Prisma.TransactionClient,
    changeRequest: {
      targetType: VehicleDocumentKind;
      targetDocumentId: string;
      vehicleId: string;
      payload: unknown;
    },
  ): Promise<void> {
    const payload = changeRequest.payload as VehicleDocumentChangePayload;

    switch (changeRequest.targetType) {
      case VehicleDocumentKind.INSPECTION: {
        const { data, changedFields } = parseInspectionStoredPayload(
          changeRequest.payload,
        );
        const update =
          changedFields && changedFields.length > 0
            ? inspectionPayloadToPartialPrismaUpdate(data, changedFields)
            : inspectionPayloadToPrismaUpdate(data);
        await tx.vehicleInspection.update({
          where: { id: changeRequest.targetDocumentId },
          data: update,
        });
        return;
      }
      case VehicleDocumentKind.INSURANCE:
        await tx.vehicleInsurance.update({
          where: { id: changeRequest.targetDocumentId },
          data: insurancePayloadToPrismaUpdate(payload as InsuranceChangePayload),
        });
        return;
      case VehicleDocumentKind.PCO_DOCUMENT:
        await tx.vehiclePcoDocument.update({
          where: { id: changeRequest.targetDocumentId },
          data: pcoDocumentPayloadToPrismaUpdate(payload as PcoDocumentChangePayload),
        });
        return;
      case VehicleDocumentKind.PERMISSION_LETTER:
        await tx.permissionLetter.update({
          where: { id: changeRequest.targetDocumentId },
          data: documentOnlyPayloadToPrismaUpdate(payload as DocumentOnlyChangePayload),
        });
        return;
      case VehicleDocumentKind.SCHEDULE:
        await tx.vehicleSchedule.update({
          where: { id: changeRequest.targetDocumentId },
          data: documentOnlyPayloadToPrismaUpdate(payload as DocumentOnlyChangePayload),
        });
        return;
      case VehicleDocumentKind.LOG_BOOK_V5:
        await tx.logBookV5.update({
          where: { id: changeRequest.targetDocumentId },
          data: documentOnlyPayloadToPrismaUpdate(
            payload as DocumentOnlyChangePayload,
          ) as Prisma.LogBookV5UpdateInput,
        });
        return;
      default:
        throw new BadRequestException('Unsupported document type');
    }
  }

  async adminReview(
    requestId: string,
    dto: AdminReviewVehicleDocumentChangeRequestDto,
    requester: Requester,
  ) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    if (
      dto.decision === VehicleDocumentChangeRequestStatus.REJECTED &&
      !dto.rejectedReason?.trim()
    ) {
      throw new BadRequestException(
        'rejectedReason is required when decision is REJECTED',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const changeRequest = await tx.vehicleDocumentChangeRequest.findUnique({
        where: { id: requestId },
      });
      if (!changeRequest) throw new NotFoundException('Change request not found');
      if (
        changeRequest.status !==
        VehicleDocumentChangeRequestStatus.PENDING_REVIEW
      ) {
        throw new ConflictException('Change request is not pending review');
      }

      const targetStatus = await this.getTargetDocumentStatus(
        changeRequest.targetType,
        changeRequest.targetDocumentId,
        changeRequest.vehicleId,
        tx,
      );
      if (targetStatus === null) {
        throw new NotFoundException('Target vehicle document not found');
      }
      if (targetStatus !== DocumentStatus.ACCEPTED) {
        throw new ConflictException(
          'Target document is no longer accepted; cannot apply change request',
        );
      }

      const reviewData = {
        status: dto.decision,
        reviewed_by_id: requester.userId,
        reviewed_at: new Date(),
        rejected_reason:
          dto.decision === VehicleDocumentChangeRequestStatus.REJECTED
            ? (dto.rejectedReason?.trim() ?? null)
            : null,
      };

      if (dto.decision === VehicleDocumentChangeRequestStatus.ACCEPTED) {
        await this.applyAcceptedPayload(tx, changeRequest);
      }

      const updatedRequest = await tx.vehicleDocumentChangeRequest.update({
        where: { id: requestId },
        data: reviewData,
      });

      return {
        updatedRequest,
        driverId: changeRequest.driverId,
        targetType: changeRequest.targetType,
      };
    });

    void tryNotifyDriverVehicleDocumentChangeRequestReviewed(
      this.notificationClient,
      this.logger,
      {
        driverUserId: result.driverId,
        targetType: result.targetType,
        accepted: dto.decision === VehicleDocumentChangeRequestStatus.ACCEPTED,
        rejectedReason: dto.rejectedReason,
      },
    );

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(result.updatedRequest),
      message:
        dto.decision === VehicleDocumentChangeRequestStatus.ACCEPTED
          ? 'Vehicle document change request accepted successfully'
          : 'Vehicle document change request rejected successfully',
    });
  }

  /**
   * Admin: permanently remove a completed change request record (e.g. after ACCEPTED).
   * Does not alter the live document — only deletes the request row.
   */
  async adminRemove(requestId: string, requester: Requester) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const row = await this.prisma.vehicleDocumentChangeRequest.findUnique({
      where: { id: requestId },
    });
    if (!row) throw new NotFoundException('Change request not found');

    if (row.status === VehicleDocumentChangeRequestStatus.PENDING_REVIEW) {
      throw new ConflictException(
        'Cannot delete a pending change request. Reject it via review or ask the driver to cancel it first.',
      );
    }

    await this.prisma.vehicleDocumentChangeRequest.delete({
      where: { id: requestId },
    });

    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle document change request deleted successfully',
    });
  }
}
