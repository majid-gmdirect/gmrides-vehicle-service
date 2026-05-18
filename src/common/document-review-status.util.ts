export type NormalizedReviewStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export function normalizeToReviewStatus(status: string): NormalizedReviewStatus {
  const upper = status.toUpperCase();
  if (upper === 'APPROVED' || upper === 'ACCEPTED' || upper === 'ACTIVE') {
    return 'ACCEPTED';
  }
  if (upper === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}
