import { Prisma } from '@prisma/client';
import {
  classifyRef,
  DocumentReference,
  DocumentStore,
  DocumentTable,
  formatSummary,
  HttpUploadClient,
  LookupResult,
  MoveResult,
  parseArgs,
  runMigration,
  UploadClient,
} from './move-vehicle-documents-to-private';

const FILES = 'https://assets.gmrides.co.uk/uploads';

/** An in-memory database: one JSON value per table/row/column. */
class MemoryStore implements DocumentStore {
  columns = new Map<string, unknown>();
  photoIds = new Set<string>();
  /** Rows whose value changes after they are read. */
  editedMeanwhile = new Set<string>();

  set(table: DocumentTable, rowId: string, column: string, value: unknown) {
    this.columns.set(`${table}:${rowId}:${column}`, value);
  }

  get(table: DocumentTable, rowId: string, column: string) {
    return this.columns.get(`${table}:${rowId}:${column}`);
  }

  loadReferences(): Promise<DocumentReference[]> {
    const out: DocumentReference[] = [];
    for (const [key, value] of this.columns) {
      const [table, rowId, column] = key.split(':') as [
        DocumentTable,
        string,
        DocumentReference['column'],
      ];
      if (column === 'payload') {
        const keys =
          table === 'vehicleChangeRequest'
            ? (['permission_letter', 'vehicle_schedule'] as const)
            : (['document'] as const);
        for (const k of keys) {
          out.push({
            table,
            rowId,
            column,
            key: k,
            field: k,
            ref: (value as Record<string, unknown>)[k],
            columnValue: value,
          });
        }
      } else {
        out.push({
          table,
          rowId,
          column,
          field: table === 'logBookV5' ? 'log_book_v5' : column,
          ref: value,
          columnValue: value,
        });
      }
    }
    return Promise.resolve(out);
  }

  loadPhotoUploadIds() {
    return Promise.resolve(this.photoIds);
  }

  rewrite(
    reference: DocumentReference,
    expected: unknown,
    next: Prisma.InputJsonValue,
  ): Promise<boolean> {
    const key = `${reference.table}:${reference.rowId}:${reference.column}`;
    if (this.editedMeanwhile.has(key)) return Promise.resolve(false);
    if (JSON.stringify(this.columns.get(key)) !== JSON.stringify(expected)) {
      return Promise.resolve(false);
    }
    this.columns.set(key, next);
    return Promise.resolve(true);
  }
}

/** upload-service: ids it knows, and which are private. */
class FakeUploads implements UploadClient {
  privateIds = new Set<string>();
  known = new Set<string>();
  failing = new Set<string>();
  byUrl = new Map<string, string>();
  moves: string[] = [];
  fields = new Map<string, string>();

  lookup(id: string): Promise<LookupResult> {
    if (!this.known.has(id)) return Promise.resolve('missing');
    return Promise.resolve(this.privateIds.has(id) ? 'private' : 'public');
  }

  lookupByUrl(url: string): Promise<string | null> {
    return Promise.resolve(this.byUrl.get(url) ?? null);
  }

  moveToPrivate(id: string, field: string): Promise<MoveResult> {
    this.moves.push(id);
    this.fields.set(id, field);
    if (this.failing.has(id)) return Promise.reject(new Error('502'));
    if (!this.known.has(id)) return Promise.resolve({ status: 'missing' });
    const wasPublic = !this.privateIds.has(id);
    this.privateIds.add(id);
    return Promise.resolve({
      status: 'moved',
      oldUrls: wasPublic
        ? [`${FILES}/${id}.pdf`, `${FILES}/${id}-thumb.jpg`]
        : [],
    });
  }
}

describe('move-vehicle-documents-to-private', () => {
  let store: MemoryStore;
  let uploads: FakeUploads;
  const log = jest.fn();

  beforeEach(() => {
    log.mockReset();
    store = new MemoryStore();
    uploads = new FakeUploads();
    for (const id of ['v5', 'ins', 'letter', 'sched', 'proposed']) {
      uploads.known.add(id);
    }
    store.set('logBookV5', 'lb-1', 'document', {
      id: 'v5',
      url: `${FILES}/v5.pdf`,
    });
    store.set('vehicleInsurance', 'in-1', 'document', {
      id: 'ins',
      url: `${FILES}/ins.pdf`,
    });
    store.set('vehicleInspection', 'mot-1', 'document', {
      id: 'done',
      isPrivate: true,
    });
    store.set('vehiclePcoDocument', 'pco-1', 'document', null);
    store.set('permissionLetter', 'pl-1', 'document', {
      url: `${FILES}/legacy.pdf`,
    });
    store.set('vehicle', 'veh-1', 'permission_letter', {
      id: 'letter',
      url: `${FILES}/letter.pdf`,
    });
    store.set('vehicleChangeRequest', 'vcr-1', 'payload', {
      make: 'Toyota',
      permission_letter: { id: 'letter', url: `${FILES}/letter.pdf` },
      vehicle_schedule: { id: 'sched', url: `${FILES}/sched.pdf` },
      changedFields: ['permission_letter', 'vehicle_schedule'],
    });
    store.set('vehicleDocumentChangeRequest', 'dcr-1', 'payload', {
      document: { url: `${FILES}/proposed.pdf`, id: 'proposed' },
      changedFields: ['document'],
    });
  });

  it('changes nothing on a dry run', async () => {
    const before = JSON.stringify([...store.columns]);
    const summary = await runMigration({ store, uploads, apply: false, log });

    expect(JSON.stringify([...store.columns])).toBe(before);
    expect(uploads.moves).toEqual([]);
    expect(summary.wouldMove.sort()).toEqual(
      ['ins', 'letter', 'proposed', 'sched', 'v5'].sort(),
    );
    expect(summary.oldPublicUrls).toContain(`${FILES}/v5.pdf`);
    expect(summary.noIdUrls).toEqual([`${FILES}/legacy.pdf`]);
  });

  it('moves each public upload once and rewrites every reference to it', async () => {
    const summary = await runMigration({ store, uploads, apply: true, log });

    expect(uploads.moves.sort()).toEqual(
      ['ins', 'letter', 'proposed', 'sched', 'v5'].sort(),
    );
    expect(store.get('logBookV5', 'lb-1', 'document')).toEqual({
      id: 'v5',
      isPrivate: true,
    });
    expect(store.get('vehicle', 'veh-1', 'permission_letter')).toEqual({
      id: 'letter',
      isPrivate: true,
    });
    // Both files in one change request, other payload keys kept.
    expect(store.get('vehicleChangeRequest', 'vcr-1', 'payload')).toEqual({
      make: 'Toyota',
      permission_letter: { id: 'letter', isPrivate: true },
      vehicle_schedule: { id: 'sched', isPrivate: true },
      changedFields: ['permission_letter', 'vehicle_schedule'],
    });
    expect(
      store.get('vehicleDocumentChangeRequest', 'dcr-1', 'payload'),
    ).toEqual({
      document: { id: 'proposed', isPrivate: true },
      changedFields: ['document'],
    });
    // Untouched: already private, empty, and a url with no upload id.
    expect(store.get('vehicleInspection', 'mot-1', 'document')).toEqual({
      id: 'done',
      isPrivate: true,
    });
    expect(store.get('permissionLetter', 'pl-1', 'document')).toEqual({
      url: `${FILES}/legacy.pdf`,
    });

    expect(summary.rewritten).toBe(6);
    expect(summary.failed).toEqual([]);
    expect(summary.noIdUrls).toEqual([`${FILES}/legacy.pdf`]);
    // The document type goes to upload-service as `field`.
    expect(uploads.fields.get('v5')).toBe('log_book_v5');
    expect(uploads.fields.get('sched')).toBe('vehicle_schedule');
    // The file and its resized copies, for the cache purge.
    expect(summary.oldPublicUrls).toEqual(
      expect.arrayContaining([
        `${FILES}/v5.pdf`,
        `${FILES}/v5-thumb.jpg`,
        `${FILES}/letter.pdf`,
      ]),
    );
    expect(formatSummary(summary).join('\n')).toContain(`${FILES}/v5.pdf`);
  });

  it('matches a bare { url } reference to its upload and moves it', async () => {
    uploads.known.add('legacy-id');
    uploads.byUrl.set(`${FILES}/legacy.pdf`, 'legacy-id');
    const summary = await runMigration({ store, uploads, apply: true, log });

    expect(uploads.moves).toContain('legacy-id');
    expect(store.get('permissionLetter', 'pl-1', 'document')).toEqual({
      id: 'legacy-id',
      isPrivate: true,
    });
    expect(summary.noIdUrls).toEqual([]);
    expect(summary.oldPublicUrls).toContain(`${FILES}/legacy.pdf`);
  });

  it('does nothing on a second run', async () => {
    await runMigration({ store, uploads, apply: true, log });
    uploads.moves = [];
    const again = await runMigration({ store, uploads, apply: true, log });

    expect(uploads.moves).toEqual([]);
    expect(again.candidateIds).toBe(0);
    expect(again.rewritten).toBe(0);
  });

  it('finishes the job when a move happened but the rewrite did not', async () => {
    uploads.privateIds.add('v5'); // moved earlier, row still has the url
    await runMigration({ store, uploads, apply: true, log });
    expect(store.get('logBookV5', 'lb-1', 'document')).toEqual({
      id: 'v5',
      isPrivate: true,
    });
  });

  it('leaves the references alone when the move fails or the file is missing', async () => {
    uploads.failing.add('v5');
    uploads.known.delete('ins');
    const summary = await runMigration({ store, uploads, apply: true, log });

    expect(summary.failed.map((f) => f.id)).toEqual(['v5']);
    expect(summary.missing).toEqual(['ins']);
    expect(store.get('logBookV5', 'lb-1', 'document')).toEqual({
      id: 'v5',
      url: `${FILES}/v5.pdf`,
    });
    expect(store.get('vehicleInsurance', 'in-1', 'document')).toEqual({
      id: 'ins',
      url: `${FILES}/ins.pdf`,
    });
  });

  it('does not overwrite a row edited while the script runs', async () => {
    store.editedMeanwhile.add('logBookV5:lb-1:document');
    const summary = await runMigration({ store, uploads, apply: true, log });
    expect(summary.conflicts).toBe(1);
  });

  it('keeps an upload public when a vehicle photo also uses it', async () => {
    store.photoIds.add('v5');
    const summary = await runMigration({ store, uploads, apply: true, log });
    expect(summary.sharedWithPhotos).toEqual(['v5']);
    expect(uploads.moves).not.toContain('v5');
  });
});

describe('classifyRef', () => {
  it('sorts references', () => {
    expect(classifyRef(null)).toBe('empty');
    expect(classifyRef({ id: '', url: '' })).toBe('empty');
    expect(classifyRef({ url: 'u' })).toBe('no-id');
    expect(classifyRef({ id: 'a', isPrivate: true })).toBe('private');
    expect(classifyRef({ id: 'a', url: 'u' })).toBe('public');
    expect(classifyRef({ id: 'a', url: 'u', isPrivate: true })).toBe('public');
  });
});

describe('parseArgs', () => {
  it('defaults to a dry run', () => {
    expect(parseArgs([])).toEqual({ apply: false });
    expect(parseArgs(['--dry-run'])).toEqual({ apply: false });
    expect(parseArgs(['--apply'])).toEqual({ apply: true });
    expect(parseArgs(['--apply', '--dry-run'])).toBeNull();
    expect(parseArgs(['--yes'])).toBeNull();
  });
});

describe('HttpUploadClient', () => {
  const reply = (status: number, body: unknown) =>
    jest.fn().mockResolvedValue({
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    });

  it('calls move-to-private-internal with the internal key and field', async () => {
    const fetchImpl = reply(200, {
      id: 'up 1',
      isPrivate: true,
      field: 'log_book_v5',
      oldUrl: `${FILES}/up.pdf`,
      oldDerivedUrls: [`${FILES}/up-thumb.jpg`],
    });
    const client = new HttpUploadClient(
      'https://api.example.test/',
      'key',
      fetchImpl,
    );
    await expect(client.moveToPrivate('up 1', 'log_book_v5')).resolves.toEqual({
      status: 'moved',
      oldUrls: [`${FILES}/up.pdf`, `${FILES}/up-thumb.jpg`],
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.example.test/api/uploads/move-to-private-internal/up%201',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer key',
      'Content-Type': 'application/json',
    });
    expect(init.body).toBe('{"field":"log_book_v5"}');
  });

  it('looks an upload up by url, and reads 404 as no match', async () => {
    const found = reply(200, { id: 'up-1', isPrivate: false });
    const client = new HttpUploadClient(
      'https://api.example.test',
      'key',
      found,
    );
    await expect(client.lookupByUrl(`${FILES}/a b.pdf`)).resolves.toBe('up-1');
    const [lookupUrl] = found.mock.calls[0] as [string];
    expect(lookupUrl).toBe(
      `https://api.example.test/api/uploads/lookup-by-url-internal?url=${encodeURIComponent(`${FILES}/a b.pdf`)}`,
    );

    const none = new HttpUploadClient(
      'https://api.example.test',
      'key',
      reply(404, {}),
    );
    await expect(none.lookupByUrl(`${FILES}/a.pdf`)).resolves.toBeNull();
  });

  it('treats 404 as missing and anything unexpected as a failure', async () => {
    const missing = new HttpUploadClient(
      'https://api.example.test',
      'key',
      reply(404, {}),
    );
    await expect(missing.moveToPrivate('x', 'log_book_v5')).resolves.toEqual({
      status: 'missing',
    });
    await expect(missing.lookup('x')).resolves.toBe('missing');

    const broken = new HttpUploadClient(
      'https://api.example.test',
      'key',
      reply(200, { id: 'x', isPrivate: false }),
    );
    await expect(broken.moveToPrivate('x', 'log_book_v5')).rejects.toThrow();
  });
});
