import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { VehicleDocumentKind } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { vehicleDocumentKindLabel } from './vehicle-document-change-payload.util';

const EMAIL_ONLY_CHANNELS = {
  toEmail: true,
  toApp: false,
  toWhatsapp: false,
} as const;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function emitEmailNotification(
  notificationClient: ClientProxy,
  logger: Logger,
  payload: {
    title: string;
    description: string;
    userId: string;
    audience: 'driver' | 'admin';
  },
): Promise<void> {
  try {
    await firstValueFrom(
      notificationClient
        .emit('create-notification', {
          title: payload.title,
          description: payload.description,
          link: '/dashboard',
          type: 'system',
          audience: payload.audience,
          userId: payload.userId,
          ...EMAIL_ONLY_CHANNELS,
        })
        .pipe(timeout(5000)),
    );
  } catch (err) {
    logger.error(
      `Email notification emit failed for user ${payload.userId}: ${payload.title}`,
      err instanceof Error ? err.stack : String(err),
    );
  }
}

/** Email driver when admin accepts their vehicle document (initial review). */
export async function tryNotifyDriverVehicleDocumentAccepted(
  notificationClient: ClientProxy,
  logger: Logger,
  params: {
    driverUserId: string;
    targetType: VehicleDocumentKind;
  },
): Promise<void> {
  const label = vehicleDocumentKindLabel(params.targetType);
  const title = `Your ${label} was approved`;
  const description =
    `<p>Your ${label} has been reviewed and <strong>approved</strong>.</p>` +
    `<p>You can sign in to your driver account to view your vehicle documents.</p>`;

  await emitEmailNotification(notificationClient, logger, {
    title,
    description,
    userId: params.driverUserId,
    audience: 'driver',
  });
}

/** Email driver when admin rejects their vehicle document (initial review). */
export async function tryNotifyDriverVehicleDocumentRejected(
  notificationClient: ClientProxy,
  logger: Logger,
  params: {
    driverUserId: string;
    targetType: VehicleDocumentKind;
    rejectedReason?: string | null;
  },
): Promise<void> {
  const label = vehicleDocumentKindLabel(params.targetType);
  const title = `Your ${label} was not approved`;
  const reasonBlock = params.rejectedReason?.trim()
    ? `<p><strong>Reason:</strong> ${escapeHtml(params.rejectedReason.trim())}</p>`
    : '';
  const description =
    `<p>Your ${label} was not approved.</p>` +
    reasonBlock +
    `<p>Please sign in to your driver account, review the feedback, update your vehicle documents, and resubmit if required.</p>`;

  await emitEmailNotification(notificationClient, logger, {
    title,
    description,
    userId: params.driverUserId,
    audience: 'driver',
  });
}

/** Email driver when admin accepts or rejects a change request on an accepted document. */
export async function tryNotifyDriverVehicleDocumentChangeRequestReviewed(
  notificationClient: ClientProxy,
  logger: Logger,
  params: {
    driverUserId: string;
    targetType: VehicleDocumentKind;
    accepted: boolean;
    rejectedReason?: string | null;
  },
): Promise<void> {
  const label = vehicleDocumentKindLabel(params.targetType);
  const title = params.accepted
    ? `Your ${label} update was accepted`
    : `Your ${label} update was not accepted`;

  let description: string;
  if (params.accepted) {
    description =
      `<p>Your requested changes to your ${label} were <strong>accepted</strong> and are now active.</p>` +
      `<p>Sign in to your driver account to view the updated document.</p>`;
  } else {
    const reason = params.rejectedReason?.trim();
    const reasonBlock = reason
      ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
      : '';
    description =
      `<p>Your requested changes to your ${label} were <strong>not accepted</strong>.</p>` +
      reasonBlock +
      `<p>Your current approved document is unchanged. You may submit a new change request if needed.</p>`;
  }

  await emitEmailNotification(notificationClient, logger, {
    title,
    description,
    userId: params.driverUserId,
    audience: 'driver',
  });
}

/** Email driver when admin requests optional vehicle documents. */
export async function tryNotifyDriverOptionalDocumentsRequested(
  notificationClient: ClientProxy,
  logger: Logger,
  params: { driverUserId: string },
): Promise<void> {
  await emitEmailNotification(notificationClient, logger, {
    title: 'Additional vehicle documents required',
    description:
      '<p>Your vehicle profile requires additional documents: <strong>permission letter</strong> and <strong>vehicle schedule</strong>.</p>' +
      '<p>Please sign in to your driver account, upload both documents, and wait for admin review.</p>',
    userId: params.driverUserId,
    audience: 'driver',
  });
}

/** Email driver when admin approves their vehicle profile (isApproved). */
export async function tryNotifyDriverVehicleApproved(
  notificationClient: ClientProxy,
  logger: Logger,
  params: { driverUserId: string },
): Promise<void> {
  await emitEmailNotification(notificationClient, logger, {
    title: 'Your vehicle was approved',
    description:
      '<p>Your vehicle profile has been reviewed and <strong>approved</strong>.</p>' +
      '<p>To change vehicle details after approval, submit a change request from your driver account.</p>',
    userId: params.driverUserId,
    audience: 'driver',
  });
}

/** Email driver when admin accepts or rejects a vehicle profile change request. */
export async function tryNotifyDriverVehicleChangeRequestReviewed(
  notificationClient: ClientProxy,
  logger: Logger,
  params: {
    driverUserId: string;
    accepted: boolean;
    rejectedReason?: string | null;
  },
): Promise<void> {
  const title = params.accepted
    ? 'Your vehicle update was accepted'
    : 'Your vehicle update was not accepted';

  let description: string;
  if (params.accepted) {
    description =
      '<p>Your requested changes to your vehicle profile were <strong>accepted</strong> and are now active.</p>' +
      '<p>Sign in to your driver account to view the updated vehicle.</p>';
  } else {
    const reason = params.rejectedReason?.trim();
    const reasonBlock = reason
      ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
      : '';
    description =
      '<p>Your requested changes to your vehicle profile were <strong>not accepted</strong>.</p>' +
      reasonBlock +
      '<p>Your current approved vehicle details are unchanged. You may submit a new change request if needed.</p>';
  }

  await emitEmailNotification(notificationClient, logger, {
    title,
    description,
    userId: params.driverUserId,
    audience: 'driver',
  });
}
