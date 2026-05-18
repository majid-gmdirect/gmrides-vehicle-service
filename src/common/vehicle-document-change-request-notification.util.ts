import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { VehicleDocumentKind } from '@prisma/client';
import { lastValueFrom } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { vehicleDocumentKindLabel } from './vehicle-document-change-payload.util';

const EMAIL_ONLY_CHANNELS = {
  toEmail: true,
  toApp: false,
  toWhatsapp: false,
} as const;

async function fetchAdminUserIds(
  httpService: HttpService,
  logger: Logger,
): Promise<string[]> {
  const baseUrl = process.env.BASE_API_URL?.trim();
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  if (!baseUrl || !internalKey) {
    logger.warn(
      'BASE_API_URL or INTERNAL_API_KEY not set; skipping admin change-request notification',
    );
    return [];
  }

  try {
    const res = await lastValueFrom(
      httpService.get<{ ids?: string[]; data?: { ids?: string[] } }>(
        `${baseUrl.replace(/\/$/, '')}/api/users/main/internal/admin-ids`,
        {
          headers: { Authorization: `Bearer ${internalKey}` },
          timeout: 8000,
        },
      ),
    );
    const body = res.data;
    const ids =
      body?.ids ??
      (body?.data && typeof body.data === 'object' ? body.data.ids : undefined);
    return Array.isArray(ids) ? ids : [];
  } catch (err) {
    logger.warn(
      `Failed to fetch admin ids for change-request notification: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return [];
  }
}

/** Email admins when a driver submits a vehicle document change request. */
export async function notifyAdminsVehicleDocumentChangeRequestSubmitted(
  httpService: HttpService,
  notificationClient: ClientProxy,
  logger: Logger,
  params: {
    driverUserId: string;
    vehicleId: string;
    targetType: VehicleDocumentKind;
  },
): Promise<void> {
  const admins = await fetchAdminUserIds(httpService, logger);
  if (admins.length === 0) {
    logger.warn(
      'No admin users found; skipping vehicle change request submitted notification',
    );
    return;
  }

  const label = vehicleDocumentKindLabel(params.targetType);
  const description =
    `<p>A driver submitted a change request for their <strong>${label}</strong>.</p>` +
    `<p>Driver ID: ${params.driverUserId}<br/>Vehicle ID: ${params.vehicleId}</p>` +
    `<p>Please review it in the admin dashboard.</p>`;

  for (const adminId of admins) {
    try {
      await firstValueFrom(
        notificationClient
          .emit('create-notification', {
            title: `Vehicle ${label} update requested`,
            description,
            link: '/dashboard',
            type: 'system',
            audience: 'admin',
            userId: adminId,
            ...EMAIL_ONLY_CHANNELS,
          })
          .pipe(timeout(5000)),
      );
    } catch (err) {
      logger.error(
        `Vehicle change request submitted notification emit failed for admin ${adminId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
