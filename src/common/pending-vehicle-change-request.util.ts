import { VehicleDocumentChangeRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PendingVehicleProfileChangeRequestSummary = {
  id: string;
  status: VehicleDocumentChangeRequestStatus;
  createdAt: Date;
};

export async function findPendingVehicleChangeRequestByVehicleId(
  prisma: PrismaService,
  vehicleId: string,
): Promise<PendingVehicleProfileChangeRequestSummary | null> {
  const row = await prisma.vehicleChangeRequest.findFirst({
    where: {
      vehicleId,
      status: VehicleDocumentChangeRequestStatus.PENDING_REVIEW,
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, createdAt: true },
  });
  return row ?? null;
}

export async function findPendingVehicleChangeRequestsByVehicleIds(
  prisma: PrismaService,
  vehicleIds: string[],
): Promise<Map<string, PendingVehicleProfileChangeRequestSummary>> {
  if (vehicleIds.length === 0) return new Map();

  const rows = await prisma.vehicleChangeRequest.findMany({
    where: {
      vehicleId: { in: vehicleIds },
      status: VehicleDocumentChangeRequestStatus.PENDING_REVIEW,
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, createdAt: true, vehicleId: true },
  });

  const map = new Map<string, PendingVehicleProfileChangeRequestSummary>();
  for (const row of rows) {
    if (!map.has(row.vehicleId)) {
      map.set(row.vehicleId, {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
      });
    }
  }
  return map;
}

export function attachPendingVehicleChangeRequest<T extends Record<string, unknown>>(
  row: T,
  pending: PendingVehicleProfileChangeRequestSummary | null,
): T & {
  pendingChangeRequest: {
    id: string;
    status: VehicleDocumentChangeRequestStatus;
    createdAt: string;
  } | null;
} {
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

export async function attachPendingToVehicleRows<T extends { id: string }>(
  prisma: PrismaService,
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
  const pendingByVehicleId = await findPendingVehicleChangeRequestsByVehicleIds(
    prisma,
    rows.map((r) => r.id),
  );
  return rows.map((row) =>
    attachPendingVehicleChangeRequest(row, pendingByVehicleId.get(row.id) ?? null),
  );
}
