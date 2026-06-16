export type NormalizedReviewStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export function normalizeToReviewStatus(status: string): NormalizedReviewStatus {
  const upper = status.toUpperCase();
  if (upper === 'APPROVED' || upper === 'ACCEPTED' || upper === 'ACTIVE') {
    return 'ACCEPTED';
  }
  if (upper === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

/** Worst-case status when multiple records exist: REJECTED > PENDING > ACCEPTED. */
export function pickAggregateReviewStatus(
  statuses: NormalizedReviewStatus[],
): NormalizedReviewStatus | null {
  if (statuses.length === 0) return null;
  if (statuses.includes('REJECTED')) return 'REJECTED';
  if (statuses.includes('PENDING')) return 'PENDING';
  return 'ACCEPTED';
}
