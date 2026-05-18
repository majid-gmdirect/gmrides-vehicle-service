import {
  VehicleDocumentChangeRequestStatus,
  VehicleDocumentKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PendingVehicleChangeRequestSummary = {
  id: string;
  status: VehicleDocumentChangeRequestStatus;
  createdAt: Date;
};

function targetKey(
  targetType: VehicleDocumentKind,
  targetDocumentId: string,
): string {
  return `${targetType}:${targetDocumentId}`;
}

export async function findPendingVehicleDocumentChangeRequests(
  prisma: PrismaService,
  targets: Array<{ targetType: VehicleDocumentKind; targetDocumentId: string }>,
): Promise<Map<string, PendingVehicleChangeRequestSummary>> {
  if (targets.length === 0) return new Map();

  const rows = await prisma.vehicleDocumentChangeRequest.findMany({
    where: {
      status: VehicleDocumentChangeRequestStatus.PENDING_REVIEW,
      OR: targets.map((t) => ({
        targetType: t.targetType,
        targetDocumentId: t.targetDocumentId,
      })),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      createdAt: true,
      targetType: true,
      targetDocumentId: true,
    },
  });

  const map = new Map<string, PendingVehicleChangeRequestSummary>();
  for (const row of rows) {
    const key = targetKey(row.targetType, row.targetDocumentId);
    if (!map.has(key)) {
      map.set(key, {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
      });
    }
  }
  return map;
}

export function attachPendingVehicleChangeRequest<
  T extends Record<string, unknown>,
>(
  row: T,
  targetType: VehicleDocumentKind,
  pendingByTarget: Map<string, PendingVehicleChangeRequestSummary>,
): T & {
  pendingChangeRequest: {
    id: string;
    status: VehicleDocumentChangeRequestStatus;
    createdAt: string;
  } | null;
} {
  const key = targetKey(targetType, row.id as string);
  const pending = pendingByTarget.get(key);
  return {
    ...row,
    pendingChangeRequest: pending
      ? {
          id: pending.id,
          status: pending.status,
          createdAt: pending.createdAt.toISOString(),
        }
      : null,
  };
}

export async function attachPendingToVehicleDocumentRows<
  T extends { id: string },
>(
  prisma: PrismaService,
  targetType: VehicleDocumentKind,
  rows: T[],
): Promise<
  Array<
    T & {
      pendingChangeRequest: {
        id: string;
        status: VehicleDocumentChangeRequestStatus;
        createdAt: string;
      } | null;
    }
  >
> {
  const pendingByTarget = await findPendingVehicleDocumentChangeRequests(
    prisma,
    rows.map((r) => ({ targetType, targetDocumentId: r.id })),
  );
  return rows.map((row) =>
    attachPendingVehicleChangeRequest(row, targetType, pendingByTarget),
  );
}
