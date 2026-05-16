import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type VehicleDocumentKind =
  | 'vehicle_inspection'
  | 'vehicle_insurance'
  | 'vehicle_pco_document';

const LABELS: Record<VehicleDocumentKind, string> = {
  vehicle_inspection: 'vehicle inspection document',
  vehicle_insurance: 'vehicle insurance document',
  vehicle_pco_document: 'vehicle PCO document',
};

/** Best-effort email + in-app notification when a vehicle document is rejected. */
export function tryNotifyVehicleDocumentRejected(
  notificationClient: ClientProxy,
  logger: Logger,
  params: {
    driverUserId: string;
    documentKind: VehicleDocumentKind;
    rejectedReason?: string | null;
  },
): void {
  const label = LABELS[params.documentKind];
  const title = `Your ${label} was not approved`;
  const reasonBlock = params.rejectedReason?.trim()
    ? `<p><strong>Reason:</strong> ${escapeHtml(params.rejectedReason.trim())}</p>`
    : '';
  const description =
    `<p>Your ${label} was not approved.</p>` +
    reasonBlock +
    `<p>Please sign in to your driver account, review the feedback, update your vehicle documents, and resubmit if required.</p>`;

  try {
    notificationClient.emit('create-notification', {
      title,
      description,
      link: '/dashboard',
      type: 'system',
      audience: 'driver',
      userId: params.driverUserId,
      toEmail: true,
      toApp: true,
      toWhatsapp: false,
    });
  } catch (err) {
    logger.error(
      `Vehicle document rejection notification emit failed for driver ${params.driverUserId}`,
      err instanceof Error ? err.stack : String(err),
    );
  }
}
