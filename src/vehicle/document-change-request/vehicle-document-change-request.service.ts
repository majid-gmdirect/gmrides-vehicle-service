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
  buildInspectionChangePayload,
  buildInsuranceChangePayload,
  buildPcoDocumentChangePayload,
  DocumentOnlyChangePayload,
  documentOnlyChangePayloadDiffers,
  documentOnlyPayloadToPrismaUpdate,
  InspectionChangePayload,
  inspectionChangePayloadDiffers,
  inspectionPayloadToPrismaUpdate,
  InsuranceChangePayload,
  insuranceChangePayloadDiffers,
  insurancePayloadToPrismaUpdate,
  mapChangePayloadForResponse,
  PcoDocumentChangePayload,
  pcoDocumentChangePayloadDiffers,
  pcoDocumentPayloadToPrismaUpdate,
  VehicleDocumentChangePayload,
} from '../../common/vehicle-document-change-payload.util';
import { notifyAdminsVehicleDocumentChangeRequestSubmitted } from '../../common/vehicle-document-change-request-notification.util';
import { tryNotifyDriverVehicleDocumentChangeRequestReviewed } from '../../common/vehicle-document-driver-notification.util';
import {
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
    const payload = buildInspectionChangePayload(existing, fields);
    if (!inspectionChangePayloadDiffers(payload, existing)) {
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
      case VehicleDocumentKind.INSPECTION:
        await tx.vehicleInspection.update({
          where: { id: changeRequest.targetDocumentId },
          data: inspectionPayloadToPrismaUpdate(payload as InspectionChangePayload),
        });
        return;
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
}
