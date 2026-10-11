/**
 * One-off: move the files behind existing vehicle compliance documents to
 * upload-service's private bucket, and rewrite the stored references.
 *
 *   docker exec vehicle-service node dist/scripts/move-vehicle-documents-to-private.js
 *   docker exec vehicle-service node dist/scripts/move-vehicle-documents-to-private.js --apply
 *
 * Without --apply it is a dry run: it reads the database and asks
 * upload-service about each file, but changes nothing.
 *
 * With --apply, for each upload id that a log book, inspection, insurance,
 * PCO document, permission letter or schedule (or a change request
 * proposing one) still stores with a public url, it calls upload-service's
 * `POST /api/uploads/move-to-private-internal/:id` (naming the document
 * type as `field`), then rewrites every reference to that id to
 * `{ id, isPrivate: true }`. A reference stored as a bare `{ url }` is
 * matched to its upload through `GET lookup-by-url-internal?url=`; if
 * upload-service has no such route or no such upload, it is listed and
 * left alone. Vehicle photos are not compliance documents and stay public.
 *
 * Safe to run again: references already `{ id, isPrivate: true }` are
 * skipped, and the move is idempotent on upload-service's side. A row is
 * only rewritten if it still holds what was read, so a document edited
 * while the script runs is left alone (run it again).
 *
 * Reads DATABASE_URL, BASE_API_URL and INTERNAL_API_KEY from the
 * environment, which `docker exec` takes from the container.
 */
import { Prisma, PrismaClient, VehicleDocumentKind } from '@prisma/client';

export type DocumentTable =
  | 'logBookV5'
  | 'vehicleInspection'
  | 'vehicleInsurance'
  | 'vehiclePcoDocument'
  | 'permissionLetter'
  | 'vehicleSchedule'
  | 'vehicle'
  | 'vehicleDocumentChangeRequest'
  | 'vehicleChangeRequest';

type DocumentColumn =
  | 'document'
  | 'permission_letter'
  | 'vehicle_schedule'
  | 'payload';

type PayloadKey = 'document' | 'permission_letter' | 'vehicle_schedule';

/** One stored file reference, and where it lives. */
export type DocumentReference = {
  table: DocumentTable;
  rowId: string;
  column: DocumentColumn;
  /** The key inside a change request's `payload`. */
  key?: PayloadKey;
  /** The document type upload-service records (`log_book_v5`, ...). */
  field: string;
  /** The file reference (`{ id, url }`, `{ id, isPrivate: true }`, ...). */
  ref: unknown;
  /** The whole column value as read. */
  columnValue: unknown;
};

export const TABLE_LABELS: Record<DocumentTable, string> = {
  logBookV5: 'LogBookV5.document',
  vehicleInspection: 'VehicleInspection.document',
  vehicleInsurance: 'VehicleInsurance.document',
  vehiclePcoDocument: 'VehiclePcoDocument.document',
  permissionLetter: 'PermissionLetter.document',
  vehicleSchedule: 'VehicleSchedule.document',
  vehicle: 'Vehicle.permission_letter / vehicle_schedule',
  vehicleDocumentChangeRequest: 'VehicleDocumentChangeRequest.payload',
  vehicleChangeRequest: 'VehicleChangeRequest.payload',
};

/** upload-service's document type (its ALWAYS_PRIVATE_FIELDS names). */
const TABLE_FIELDS: Record<DocumentTable, string> = {
  logBookV5: 'log_book_v5',
  vehicleInspection: 'vehicle_inspection',
  vehicleInsurance: 'vehicle_insurance',
  vehiclePcoDocument: 'vehicle_pco_document',
  permissionLetter: 'permission_letter',
  vehicleSchedule: 'vehicle_schedule',
  // Per column or change-request target; see loadReferences.
  vehicle: 'permission_letter',
  vehicleDocumentChangeRequest: 'file',
  vehicleChangeRequest: 'permission_letter',
};

const KIND_FIELDS: Record<VehicleDocumentKind, string> = {
  INSPECTION: 'vehicle_inspection',
  INSURANCE: 'vehicle_insurance',
  PCO_DOCUMENT: 'vehicle_pco_document',
  PERMISSION_LETTER: 'permission_letter',
  SCHEDULE: 'vehicle_schedule',
  LOG_BOOK_V5: 'log_book_v5',
};

export interface DocumentStore {
  loadReferences(): Promise<DocumentReference[]>;
  /** Upload ids used by vehicle photos, which must stay public. */
  loadPhotoUploadIds(): Promise<Set<string>>;
  /**
   * Writes `next` into the reference's column if the column still holds
   * `expected`. Returns false if the row changed (or is gone) meanwhile.
   */
  rewrite(
    reference: DocumentReference,
    expected: unknown,
    next: Prisma.InputJsonValue,
  ): Promise<boolean>;
}

export type LookupResult = 'public' | 'private' | 'missing';

export type MoveResult =
  /** `oldUrls`: the public URLs the move retired (file and resized copies). */
  { status: 'moved'; oldUrls: string[] } | { status: 'missing' };

export interface UploadClient {
  lookup(id: string): Promise<LookupResult>;
  /** The upload id with this public url, or null if there is none. */
  lookupByUrl(url: string): Promise<string | null>;
  moveToPrivate(id: string, field: string): Promise<MoveResult>;
}

export type RefKind = 'empty' | 'private' | 'no-id' | 'public';

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function classifyRef(ref: unknown): RefKind {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return 'empty';
  const o = ref as Record<string, unknown>;
  const id = trimmedString(o.id);
  const url = trimmedString(o.url);
  if (!id && !url) return 'empty';
  if (!id) return 'no-id';
  if (o.isPrivate === true && !url) return 'private';
  return 'public';
}

function idOf(ref: unknown): string {
  return trimmedString((ref as Record<string, unknown>).id) ?? '';
}

function urlOf(ref: unknown): string | undefined {
  if (!ref || typeof ref !== 'object') return undefined;
  return trimmedString((ref as Record<string, unknown>).url);
}

/** The column value with this reference replaced by `{ id, isPrivate }`. */
export function privateColumnValue(
  reference: DocumentReference,
  current: unknown,
  id: string,
): Prisma.InputJsonValue {
  const privateRef = { id, isPrivate: true };
  if (reference.column !== 'payload' || !reference.key) return privateRef;
  const payload =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...payload, [reference.key]: privateRef } as Prisma.InputJsonValue;
}

function columnKey(reference: DocumentReference): string {
  return `${reference.table}:${reference.rowId}:${reference.column}`;
}

export type TableCounts = Record<RefKind, number> & { total: number };

export type MigrationSummary = {
  apply: boolean;
  byTable: Partial<Record<DocumentTable, TableCounts>>;
  /** Distinct upload ids still stored with a public url. */
  candidateIds: number;
  moved: string[];
  wouldMove: string[];
  /** Dry run: upload-service already has these private (only the stored reference is stale). */
  alreadyPrivateInUploads: string[];
  missing: string[];
  failed: { id: string; error: string }[];
  /** Also used by a vehicle photo, so left public. */
  sharedWithPhotos: string[];
  notChecked: string[];
  rewritten: number;
  /** Rows that changed between read and write; run again. */
  conflicts: number;
  /** References with a url but no upload id that no upload matched. */
  noIdUrls: string[];
  oldPublicUrls: string[];
};

export async function runMigration(params: {
  store: DocumentStore;
  uploads: UploadClient | null;
  apply: boolean;
  log: (line: string) => void;
}): Promise<MigrationSummary> {
  const { store, uploads, apply, log } = params;
  const summary: MigrationSummary = {
    apply,
    byTable: {},
    candidateIds: 0,
    moved: [],
    wouldMove: [],
    alreadyPrivateInUploads: [],
    missing: [],
    failed: [],
    sharedWithPhotos: [],
    notChecked: [],
    rewritten: 0,
    conflicts: 0,
    noIdUrls: [],
    oldPublicUrls: [],
  };

  const references = await store.loadReferences();
  const photoIds = await store.loadPhotoUploadIds();

  const byId = new Map<string, DocumentReference[]>();
  const add = (id: string, reference: DocumentReference) => {
    const list = byId.get(id) ?? [];
    list.push(reference);
    byId.set(id, list);
  };
  const noIdByUrl = new Map<string, DocumentReference[]>();
  for (const reference of references) {
    const kind = classifyRef(reference.ref);
    const counts = (summary.byTable[reference.table] ??= {
      total: 0,
      empty: 0,
      private: 0,
      'no-id': 0,
      public: 0,
    });
    counts.total += 1;
    counts[kind] += 1;
    if (kind === 'no-id') {
      const url = urlOf(reference.ref) ?? '';
      noIdByUrl.set(url, [...(noIdByUrl.get(url) ?? []), reference]);
    }
    if (kind === 'public') add(idOf(reference.ref), reference);
  }

  // A bare `{ url }` names no upload id; ask upload-service which upload
  // has that url.
  for (const [url, refs] of noIdByUrl) {
    let id: string | null = null;
    if (uploads) {
      try {
        id = await uploads.lookupByUrl(url);
      } catch (error) {
        log(`unknown ${url}: lookup by url failed: ${errorText(error)}`);
      }
    }
    if (id) refs.forEach((reference) => add(id, reference));
    else summary.noIdUrls.push(url);
  }
  summary.candidateIds = byId.size;

  // The column values as they stand, so two references in one row (a
  // vehicle change request's permission_letter and vehicle_schedule) don't
  // overwrite each other.
  const current = new Map<string, unknown>();
  for (const reference of references) {
    current.set(columnKey(reference), reference.columnValue);
  }

  const oldUrls = new Set<string>();
  for (const [id, refs] of byId) {
    const where = refs
      .map((r) => `${TABLE_LABELS[r.table]} ${r.rowId}`)
      .join(', ');
    const refUrls = refs
      .map((r) => urlOf(r.ref))
      .filter((url): url is string => !!url);

    if (photoIds.has(id)) {
      summary.sharedWithPhotos.push(id);
      log(`skip   ${id}: also used by a vehicle photo (${where})`);
      continue;
    }

    if (!apply) {
      if (!uploads) {
        summary.notChecked.push(id);
        summary.wouldMove.push(id);
        refUrls.forEach((url) => oldUrls.add(url));
        log(`would move ${id} (not checked with upload-service): ${where}`);
        continue;
      }
      try {
        const state = await uploads.lookup(id);
        if (state === 'missing') {
          summary.missing.push(id);
          log(`missing ${id}: not in upload-service (${where})`);
          continue;
        }
        if (state === 'private') {
          summary.alreadyPrivateInUploads.push(id);
          log(
            `would rewrite ${id}: already private in upload-service (${where})`,
          );
          continue;
        }
        summary.wouldMove.push(id);
        refUrls.forEach((url) => oldUrls.add(url));
        log(`would move ${id}: ${where}`);
      } catch (error) {
        summary.failed.push({ id, error: errorText(error) });
        log(`FAILED ${id}: lookup: ${errorText(error)}`);
      }
      continue;
    }

    if (!uploads) throw new Error('--apply needs upload-service');

    let result: MoveResult;
    try {
      result = await uploads.moveToPrivate(id, refs[0].field);
    } catch (error) {
      summary.failed.push({ id, error: errorText(error) });
      log(`FAILED ${id}: move: ${errorText(error)}`);
      continue;
    }
    if (result.status === 'missing') {
      summary.missing.push(id);
      log(
        `missing ${id}: not in upload-service, references left as they are (${where})`,
      );
      continue;
    }

    summary.moved.push(id);
    refUrls.forEach((url) => oldUrls.add(url));
    result.oldUrls.forEach((url) => oldUrls.add(url));

    for (const reference of refs) {
      const key = columnKey(reference);
      const expected = current.get(key);
      const next = privateColumnValue(reference, expected, id);
      try {
        if (await store.rewrite(reference, expected, next)) {
          current.set(key, next);
          summary.rewritten += 1;
        } else {
          summary.conflicts += 1;
          log(
            `changed ${id}: ${TABLE_LABELS[reference.table]} ${reference.rowId} changed while running; run again`,
          );
        }
      } catch (error) {
        summary.failed.push({ id, error: `rewrite: ${errorText(error)}` });
        log(
          `FAILED ${id}: rewrite ${TABLE_LABELS[reference.table]} ${reference.rowId}: ${errorText(error)}`,
        );
      }
    }
    log(`moved  ${id}: ${where}`);
  }
  summary.oldPublicUrls = [...oldUrls];
  return summary;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatSummary(summary: MigrationSummary): string[] {
  const lines: string[] = [];
  lines.push('');
  lines.push('References by table (total / public / private / no id / empty):');
  for (const [table, counts] of Object.entries(summary.byTable)) {
    lines.push(
      `  ${TABLE_LABELS[table as DocumentTable]}: ${counts.total} / ${counts.public} / ${counts.private} / ${counts['no-id']} / ${counts.empty}`,
    );
  }
  lines.push('');
  lines.push(`Upload ids with a public reference: ${summary.candidateIds}`);
  if (summary.apply) {
    lines.push(`  moved to private: ${summary.moved.length}`);
    lines.push(`  references rewritten: ${summary.rewritten}`);
    lines.push(
      `  rows changed while running (run again): ${summary.conflicts}`,
    );
  } else {
    lines.push(`  would move: ${summary.wouldMove.length}`);
    if (summary.notChecked.length) {
      lines.push(
        `    (${summary.notChecked.length} not checked: BASE_API_URL or INTERNAL_API_KEY is not set)`,
      );
    }
    lines.push(
      `  already private in upload-service, reference to rewrite: ${summary.alreadyPrivateInUploads.length}`,
    );
  }
  lines.push(
    `  not in upload-service (left as they are): ${summary.missing.length}`,
  );
  lines.push(
    `  also used by a vehicle photo (left public): ${summary.sharedWithPhotos.length}`,
  );
  lines.push(`  failed: ${summary.failed.length}`);
  for (const failure of summary.failed) {
    lines.push(`    ${failure.id}: ${failure.error}`);
  }
  if (summary.noIdUrls.length) {
    lines.push('');
    lines.push(
      `References with a url but no upload id that no upload matched (not moved; still as stored): ${summary.noIdUrls.length}`,
    );
    summary.noIdUrls.forEach((url) => lines.push(`  ${url}`));
  }
  lines.push('');
  lines.push(
    summary.apply
      ? `Old public URLs, now dead at the origin (purge them from the Cloudflare cache): ${summary.oldPublicUrls.length}`
      : `Public URLs that --apply would retire: ${summary.oldPublicUrls.length}`,
  );
  summary.oldPublicUrls.forEach((url) => lines.push(`  ${url}`));
  return lines;
}

// ---- Database (Prisma) -------------------------------------------------

export class PrismaDocumentStore implements DocumentStore {
  constructor(private readonly prisma: PrismaClient) {}

  async loadReferences(): Promise<DocumentReference[]> {
    const select = { id: true, document: true } as const;
    const documentTables: [
      DocumentTable,
      { id: string; document: unknown }[],
    ][] = [
      ['logBookV5', await this.prisma.logBookV5.findMany({ select })],
      [
        'vehicleInspection',
        await this.prisma.vehicleInspection.findMany({ select }),
      ],
      [
        'vehicleInsurance',
        await this.prisma.vehicleInsurance.findMany({ select }),
      ],
      [
        'vehiclePcoDocument',
        await this.prisma.vehiclePcoDocument.findMany({ select }),
      ],
      [
        'permissionLetter',
        await this.prisma.permissionLetter.findMany({ select }),
      ],
      [
        'vehicleSchedule',
        await this.prisma.vehicleSchedule.findMany({ select }),
      ],
    ];

    const out: DocumentReference[] = [];
    for (const [table, rows] of documentTables) {
      for (const row of rows) {
        out.push({
          table,
          rowId: row.id,
          column: 'document',
          field: TABLE_FIELDS[table],
          ref: row.document,
          columnValue: row.document,
        });
      }
    }

    const vehicles = await this.prisma.vehicle.findMany({
      select: { id: true, permission_letter: true, vehicle_schedule: true },
    });
    for (const vehicle of vehicles) {
      for (const column of ['permission_letter', 'vehicle_schedule'] as const) {
        out.push({
          table: 'vehicle',
          rowId: vehicle.id,
          column,
          field: column,
          ref: vehicle[column],
          columnValue: vehicle[column],
        });
      }
    }

    const documentRequests =
      await this.prisma.vehicleDocumentChangeRequest.findMany({
        select: { id: true, payload: true, targetType: true },
      });
    for (const row of documentRequests) {
      out.push(
        payloadReference(
          'vehicleDocumentChangeRequest',
          row,
          'document',
          KIND_FIELDS[row.targetType],
        ),
      );
    }
    const vehicleRequests = await this.prisma.vehicleChangeRequest.findMany({
      select: { id: true, payload: true },
    });
    for (const row of vehicleRequests) {
      for (const key of ['permission_letter', 'vehicle_schedule'] as const) {
        out.push(payloadReference('vehicleChangeRequest', row, key, key));
      }
    }
    return out;
  }

  async loadPhotoUploadIds(): Promise<Set<string>> {
    const images = await this.prisma.vehicleImage.findMany({
      select: { image: true },
    });
    const ids = new Set<string>();
    for (const { image } of images) {
      if (image && typeof image === 'object' && !Array.isArray(image)) {
        const id = trimmedString((image as Record<string, unknown>).id);
        if (id) ids.add(id);
      }
    }
    return ids;
  }

  async rewrite(
    reference: DocumentReference,
    expected: unknown,
    next: Prisma.InputJsonValue,
  ): Promise<boolean> {
    const id = reference.rowId;
    const equals = expected as Prisma.InputJsonValue;
    const p = this.prisma;
    let result: Prisma.BatchPayload;
    switch (reference.table) {
      case 'logBookV5':
        result = await p.logBookV5.updateMany({
          where: { id, document: { equals } },
          data: { document: next },
        });
        break;
      case 'vehicleInspection':
        result = await p.vehicleInspection.updateMany({
          where: { id, document: { equals } },
          data: { document: next },
        });
        break;
      case 'vehicleInsurance':
        result = await p.vehicleInsurance.updateMany({
          where: { id, document: { equals } },
          data: { document: next },
        });
        break;
      case 'vehiclePcoDocument':
        result = await p.vehiclePcoDocument.updateMany({
          where: { id, document: { equals } },
          data: { document: next },
        });
        break;
      case 'permissionLetter':
        result = await p.permissionLetter.updateMany({
          where: { id, document: { equals } },
          data: { document: next },
        });
        break;
      case 'vehicleSchedule':
        result = await p.vehicleSchedule.updateMany({
          where: { id, document: { equals } },
          data: { document: next },
        });
        break;
      case 'vehicle':
        result =
          reference.column === 'permission_letter'
            ? await p.vehicle.updateMany({
                where: { id, permission_letter: { equals } },
                data: { permission_letter: next },
              })
            : await p.vehicle.updateMany({
                where: { id, vehicle_schedule: { equals } },
                data: { vehicle_schedule: next },
              });
        break;
      case 'vehicleDocumentChangeRequest':
        result = await p.vehicleDocumentChangeRequest.updateMany({
          where: { id, payload: { equals } },
          data: { payload: next },
        });
        break;
      case 'vehicleChangeRequest':
        result = await p.vehicleChangeRequest.updateMany({
          where: { id, payload: { equals } },
          data: { payload: next },
        });
        break;
    }
    return result.count === 1;
  }
}

function payloadReference(
  table: 'vehicleDocumentChangeRequest' | 'vehicleChangeRequest',
  row: { id: string; payload: unknown },
  key: PayloadKey,
  field: string,
): DocumentReference {
  const payload =
    row.payload &&
    typeof row.payload === 'object' &&
    !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    table,
    rowId: row.id,
    column: 'payload',
    key,
    field,
    ref: payload[key],
    columnValue: row.payload,
  };
}

// ---- upload-service (HTTP) ---------------------------------------------

export class HttpUploadClient implements UploadClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(
    method: 'GET' | 'POST',
    path: string,
    requestBody?: unknown,
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.internalKey}`,
    };
    if (requestBody !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await this.fetchImpl(
      `${this.baseUrl.replace(/\/+$/, '')}${path}`,
      {
        method,
        headers,
        body:
          requestBody === undefined ? undefined : JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30_000),
      },
    );
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }

  async lookup(id: string): Promise<LookupResult> {
    const { status, body } = await this.call(
      'GET',
      `/api/uploads/lookup-internal/${encodeURIComponent(id)}`,
    );
    if (status === 404) return 'missing';
    if (status !== 200 || !isRecord(body) || body.id !== id) {
      throw new Error(`lookup-internal answered ${status}`);
    }
    return body.isPrivate === true ? 'private' : 'public';
  }

  async lookupByUrl(url: string): Promise<string | null> {
    const { status, body } = await this.call(
      'GET',
      `/api/uploads/lookup-by-url-internal?url=${encodeURIComponent(url)}`,
    );
    // 404 also when upload-service has no such route yet.
    if (status === 404) return null;
    if (status !== 200 || !isRecord(body) || typeof body.id !== 'string') {
      throw new Error(`lookup-by-url-internal answered ${status}`);
    }
    return body.id;
  }

  async moveToPrivate(id: string, field: string): Promise<MoveResult> {
    const { status, body } = await this.call(
      'POST',
      `/api/uploads/move-to-private-internal/${encodeURIComponent(id)}`,
      { field },
    );
    if (status === 404) return { status: 'missing' };
    if (
      status < 200 ||
      status >= 300 ||
      !isRecord(body) ||
      body.id !== id ||
      body.isPrivate !== true
    ) {
      throw new Error(`move-to-private-internal answered ${status}`);
    }
    const derived: unknown[] = Array.isArray(body.oldDerivedUrls)
      ? (body.oldDerivedUrls as unknown[])
      : [];
    const oldUrls = [body.oldUrl, ...derived].filter(
      (url): url is string => typeof url === 'string' && url !== '',
    );
    return { status: 'moved', oldUrls };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// ---- command line ------------------------------------------------------

const USAGE =
  'Usage: node dist/scripts/move-vehicle-documents-to-private.js [--dry-run | --apply]';

export function parseArgs(argv: string[]): { apply: boolean } | null {
  let apply = false;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--apply') apply = true;
    else if (arg === '--dry-run') dryRun = true;
    else return null;
  }
  if (apply && dryRun) return null;
  return { apply };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    return 2;
  }

  const baseUrl = process.env.BASE_API_URL?.trim();
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  const uploads =
    baseUrl && internalKey ? new HttpUploadClient(baseUrl, internalKey) : null;
  if (args.apply && !uploads) {
    console.error('--apply needs BASE_API_URL and INTERNAL_API_KEY');
    return 2;
  }

  console.log(
    args.apply
      ? 'Moving vehicle compliance documents to the private bucket (--apply).'
      : 'DRY RUN: nothing will change. Pass --apply to move the files.',
  );

  const prisma = new PrismaClient();
  try {
    const summary = await runMigration({
      store: new PrismaDocumentStore(prisma),
      uploads,
      apply: args.apply,
      log: (line) => console.log(line),
    });
    formatSummary(summary).forEach((line) => console.log(line));
    return summary.failed.length || summary.conflicts ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
