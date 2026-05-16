import { DocumentStatus } from '@prisma/client';

/**
 * When a driver updates a rejected document (new file or fields), queue it for admin review again.
 */
export function applyDriverResubmissionReviewReset(
  isAdmin: boolean,
  existingStatus: DocumentStatus,
  data: { status?: unknown; rejectedReason?: unknown },
  hasContentUpdate: boolean,
): void {
  if (isAdmin || !hasContentUpdate) return;
  if (existingStatus !== DocumentStatus.REJECTED) return;
  data.status = DocumentStatus.PENDING;
  data.rejectedReason = null;
}
