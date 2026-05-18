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
  Prisma,
  VehicleDocumentChangeRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatResponse } from '../../common/format-response.util';
import {
  buildVehicleChangePayload,
  mapVehicleChangePayloadForResponse,
  VehicleChangeInput,
  VehicleChangePayload,
  vehicleChangePayloadDiffers,
  vehiclePayloadToPrismaUpdate,
} from '../../common/vehicle-change-payload.util';
import { notifyAdminsVehicleChangeRequestSubmitted } from '../../common/vehicle-change-request-notification.util';
import { tryNotifyDriverVehicleChangeRequestReviewed } from '../../common/vehicle-document-driver-notification.util';
import {
  AdminQueryVehicleChangeRequestsDto,
  AdminReviewVehicleChangeRequestDto,
  SubmitVehicleChangeRequestDto,
} from './dto';

type Requester = { userId: string; role?: string };

@Injectable()
export class VehicleChangeRequestService {
  private readonly logger = new Logger(VehicleChangeRequestService.name);

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

  private async getVehicleForDriverOrThrow(driverId: string, vehicleId: string) {
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
      status: row.status,
      payload: mapVehicleChangePayloadForResponse(
        row.payload as VehicleChangePayload,
      ),
      driver_note: row.driver_note,
      rejected_reason: row.rejected_reason,
      reviewed_by_id: row.reviewed_by_id,
      reviewed_at: row.reviewed_at?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async submit(
    driverId: string,
    vehicleId: string,
    dto: SubmitVehicleChangeRequestDto,
    requester: Requester,
  ) {
    if (requester.role === 'ADMIN') {
      throw new ForbiddenException(
        'Admins cannot submit change requests; update the vehicle directly',
      );
    }
    this.assertDriverAccess(driverId, requester);
    const vehicle = await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    if (!vehicle.isApproved) {
      throw new BadRequestException(
        'Change requests are only available for approved vehicles. Update the vehicle directly instead.',
      );
    }

    const existingPending = await this.prisma.vehicleChangeRequest.findFirst({
      where: {
        vehicleId,
        status: VehicleDocumentChangeRequestStatus.PENDING_REVIEW,
      },
    });
    if (existingPending) {
      throw new ConflictException(
        'A change request is already pending review for this vehicle',
      );
    }

    const { driver_note, ...fields } = dto;
    const payload = buildVehicleChangePayload(
      vehicle,
      fields as VehicleChangeInput,
    );
    if (!vehicleChangePayloadDiffers(payload, vehicle)) {
      throw new BadRequestException('No changes detected in the change request');
    }

    const row = await this.prisma.vehicleChangeRequest.create({
      data: {
        driverId,
        vehicleId,
        payload: payload as unknown as Prisma.InputJsonValue,
        driver_note: driver_note ?? null,
      },
    });

    await notifyAdminsVehicleChangeRequestSubmitted(
      this.httpService,
      this.notificationClient,
      this.logger,
      { driverUserId: driverId, vehicleId },
    );

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(row),
      message: 'Vehicle change request submitted successfully',
    });
  }

  async listForVehicle(
    driverId: string,
    vehicleId: string,
    requester: Requester,
  ) {
    this.assertDriverAccess(driverId, requester);
    await this.getVehicleForDriverOrThrow(driverId, vehicleId);

    const rows = await this.prisma.vehicleChangeRequest.findMany({
      where: { driverId, vehicleId },
      orderBy: { createdAt: 'desc' },
    });

    return formatResponse({
      success: true,
      data: rows.map((row) => this.mapChangeRequestRow(row)),
      message: 'Vehicle change requests retrieved successfully',
    });
  }

  async findOne(driverId: string, requestId: string, requester: Requester) {
    this.assertDriverAccess(driverId, requester);

    const row = await this.prisma.vehicleChangeRequest.findFirst({
      where: { id: requestId, driverId },
    });
    if (!row) throw new NotFoundException('Change request not found');

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(row),
      message: 'Vehicle change request retrieved successfully',
    });
  }

  async cancel(driverId: string, requestId: string, requester: Requester) {
    if (requester.role === 'ADMIN') {
      throw new ForbiddenException(
        'Only the driver may cancel their change request',
      );
    }
    this.assertDriverAccess(driverId, requester);

    const row = await this.prisma.vehicleChangeRequest.findFirst({
      where: { id: requestId, driverId },
    });
    if (!row) throw new NotFoundException('Change request not found');
    if (row.status !== VehicleDocumentChangeRequestStatus.PENDING_REVIEW) {
      throw new ConflictException('Only pending change requests can be cancelled');
    }

    const updated = await this.prisma.vehicleChangeRequest.update({
      where: { id: requestId },
      data: { status: VehicleDocumentChangeRequestStatus.CANCELLED },
    });

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(updated),
      message: 'Vehicle change request cancelled successfully',
    });
  }

  async adminListForDriver(
    driverId: string,
    query: AdminQueryVehicleChangeRequestsDto,
    requester: Requester,
  ) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const where: Prisma.VehicleChangeRequestWhereInput = {
      driverId,
      ...(query.status !== undefined && { status: query.status }),
    };

    const rows = await this.prisma.vehicleChangeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return formatResponse({
      success: true,
      data: rows.map((row) => this.mapChangeRequestRow(row)),
      message: 'Vehicle change requests retrieved successfully',
    });
  }

  async adminListForVehicle(
    vehicleId: string,
    query: AdminQueryVehicleChangeRequestsDto,
    requester: Requester,
  ) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const where: Prisma.VehicleChangeRequestWhereInput = {
      vehicleId,
      ...(query.status !== undefined && { status: query.status }),
    };

    const rows = await this.prisma.vehicleChangeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return formatResponse({
      success: true,
      data: rows.map((row) => this.mapChangeRequestRow(row)),
      message: 'Vehicle change requests retrieved successfully',
    });
  }

  async adminFindOne(requestId: string, requester: Requester) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const row = await this.prisma.vehicleChangeRequest.findUnique({
      where: { id: requestId },
    });
    if (!row) throw new NotFoundException('Change request not found');

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(row),
      message: 'Vehicle change request retrieved successfully',
    });
  }

  async adminReview(
    requestId: string,
    dto: AdminReviewVehicleChangeRequestDto,
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
      const changeRequest = await tx.vehicleChangeRequest.findUnique({
        where: { id: requestId },
      });
      if (!changeRequest) throw new NotFoundException('Change request not found');
      if (
        changeRequest.status !==
        VehicleDocumentChangeRequestStatus.PENDING_REVIEW
      ) {
        throw new ConflictException('Change request is not pending review');
      }

      const vehicle = await tx.vehicle.findUnique({
        where: { id: changeRequest.vehicleId },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      if (!vehicle.isApproved) {
        throw new ConflictException(
          'Vehicle is no longer approved; cannot apply change request',
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
        const payload = changeRequest.payload as VehicleChangePayload;
        const duplicatePlate = await tx.vehicle.findFirst({
          where: {
            plateNumber: payload.plateNumber,
            id: { not: vehicle.id },
          },
          select: { id: true },
        });
        if (duplicatePlate) {
          throw new BadRequestException('Plate number already exists');
        }

        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: vehiclePayloadToPrismaUpdate(payload),
        });
      }

      const updatedRequest = await tx.vehicleChangeRequest.update({
        where: { id: requestId },
        data: reviewData,
      });

      return {
        updatedRequest,
        driverId: changeRequest.driverId,
      };
    });

    void tryNotifyDriverVehicleChangeRequestReviewed(
      this.notificationClient,
      this.logger,
      {
        driverUserId: result.driverId,
        accepted: dto.decision === VehicleDocumentChangeRequestStatus.ACCEPTED,
        rejectedReason: dto.rejectedReason,
      },
    );

    return formatResponse({
      success: true,
      data: this.mapChangeRequestRow(result.updatedRequest),
      message:
        dto.decision === VehicleDocumentChangeRequestStatus.ACCEPTED
          ? 'Vehicle change request accepted successfully'
          : 'Vehicle change request rejected successfully',
    });
  }

  async adminRemove(requestId: string, requester: Requester) {
    if (requester.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const row = await this.prisma.vehicleChangeRequest.findUnique({
      where: { id: requestId },
    });
    if (!row) throw new NotFoundException('Change request not found');

    if (row.status === VehicleDocumentChangeRequestStatus.PENDING_REVIEW) {
      throw new ConflictException(
        'Cannot delete a pending change request. Reject it via review or ask the driver to cancel it first.',
      );
    }

    await this.prisma.vehicleChangeRequest.delete({ where: { id: requestId } });

    return formatResponse({
      success: true,
      data: null,
      message: 'Vehicle change request deleted successfully',
    });
  }
}
