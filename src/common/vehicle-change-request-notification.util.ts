import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

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
      'BASE_API_URL or INTERNAL_API_KEY not set; skipping admin vehicle change-request notification',
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
      `Failed to fetch admin ids for vehicle change-request notification: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return [];
  }
}

export async function notifyAdminsVehicleChangeRequestSubmitted(
  httpService: HttpService,
  notificationClient: ClientProxy,
  logger: Logger,
  params: { driverUserId: string; vehicleId: string },
): Promise<void> {
  const admins = await fetchAdminUserIds(httpService, logger);
  if (admins.length === 0) return;

  const description =
    `<p>A driver submitted a change request for their <strong>vehicle profile</strong>.</p>` +
    `<p>Driver ID: ${params.driverUserId}<br/>Vehicle ID: ${params.vehicleId}</p>` +
    `<p>Please review it in the admin dashboard.</p>`;

  for (const adminId of admins) {
    try {
      await firstValueFrom(
        notificationClient
          .emit('create-notification', {
            title: 'Vehicle profile update requested',
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
        `Vehicle change request submitted notification failed for admin ${adminId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
