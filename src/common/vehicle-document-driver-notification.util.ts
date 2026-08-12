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
  const description = [
    `Your ${label} has been reviewed and approved.`,
    `You can sign in to your driver account to view your vehicle documents.`,
  ].join('\n');

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
    driverFirstName?: string | null;
  },
): Promise<void> {
  const label = vehicleDocumentKindLabel(params.targetType);
  const title = `Your ${label} was not approved`;
  const name = params.driverFirstName?.trim() || 'Driver';
  const lines = [
    `Dear ${name},`,
    `Your ${label} was not approved.`,
  ];
  if (params.rejectedReason?.trim()) {
    lines.push(`Reason: ${params.rejectedReason.trim()}`);
  }
  lines.push(
    `Please sign in to your driver account, review the feedback, update your vehicle documents, and resubmit if required.`,
  );

  await emitEmailNotification(notificationClient, logger, {
    title,
    description: lines.join('\n'),
    userId: params.driverUserId,
    audience: 'driver',
  });
}

/** Email driver when admin rejects a change request on an accepted document. */
export async function tryNotifyDriverVehicleDocumentChangeRequestReviewed(
  notificationClient: ClientProxy,
  logger: Logger,
  params: {
    driverUserId: string;
    targetType: VehicleDocumentKind;
    accepted: boolean;
    rejectedReason?: string | null;
    driverFirstName?: string | null;
  },
): Promise<void> {
  if (params.accepted) {
    return;
  }

  const label = vehicleDocumentKindLabel(params.targetType);
  const title = `Your ${label} update was not accepted`;
  const name = params.driverFirstName?.trim() || 'Driver';
  const lines = [
    `Dear ${name},`,
    `Your requested changes to your ${label} were not accepted.`,
  ];
  if (params.rejectedReason?.trim()) {
    lines.push(`Reason: ${params.rejectedReason.trim()}`);
  }
  lines.push(
    `Your current approved document is unchanged. You may submit a new change request if needed.`,
  );

  await emitEmailNotification(notificationClient, logger, {
    title,
    description: lines.join('\n'),
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
    description: [
      'Your vehicle profile has been reviewed and approved.',
      'To change vehicle details after approval, submit a change request from your driver account.',
    ].join('\n'),
    userId: params.driverUserId,
    audience: 'driver',
  });
}

/** Email driver when admin rejects a vehicle profile change request. */
export async function tryNotifyDriverVehicleChangeRequestReviewed(
  notificationClient: ClientProxy,
  logger: Logger,
  params: {
    driverUserId: string;
    accepted: boolean;
    rejectedReason?: string | null;
    driverFirstName?: string | null;
  },
): Promise<void> {
  if (params.accepted) {
    return;
  }

  const title = 'Your vehicle update was not accepted';
  const name = params.driverFirstName?.trim() || 'Driver';
  const lines = [
    `Dear ${name},`,
    'Your requested changes to your vehicle profile were not accepted.',
  ];
  if (params.rejectedReason?.trim()) {
    lines.push(`Reason: ${params.rejectedReason.trim()}`);
  }
  lines.push(
    'Your current approved vehicle details are unchanged. You may submit a new change request if needed.',
  );

  await emitEmailNotification(notificationClient, logger, {
    title,
    description: lines.join('\n'),
    userId: params.driverUserId,
    audience: 'driver',
  });
}

/**
 * Email driver when admin requests optional vehicle documents
 * (permission letter + vehicle schedule).
 */
export async function tryNotifyDriverOptionalDocumentsRequested(
  notificationClient: ClientProxy,
  logger: Logger,
  params: {
    driverUserId: string;
    driverFirstName?: string | null;
    make?: string | null;
    model?: string | null;
    plateNumber?: string | null;
  },
): Promise<void> {
  const name = params.driverFirstName?.trim() || 'Driver';
  const vehicleLabel = [params.make?.trim(), params.model?.trim()]
    .filter(Boolean)
    .join(' ');
  const plate = params.plateNumber?.trim();
  const vehicleBits = [
    vehicleLabel || null,
    plate ? `plate ${plate}` : null,
  ].filter(Boolean);
  const vehiclePhrase = vehicleBits.length
    ? ` for your vehicle (${vehicleBits.join(', ')})`
    : ' for your vehicle';

  const title = 'Additional vehicle documents required';
  const description = [
    `Dear ${name},`,
    `We need additional documents${vehiclePhrase}.`,
    'Please upload a permission letter and vehicle schedule in your driver account so we can continue reviewing your vehicle.',
  ].join('\n');

  await emitEmailNotification(notificationClient, logger, {
    title,
    description,
    userId: params.driverUserId,
    audience: 'driver',
  });
}
