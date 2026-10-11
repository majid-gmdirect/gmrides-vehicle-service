import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import {
  ResolveFileRefParams,
  UploadLookup,
  UploadOwnershipService,
} from './upload-ownership.service';

const DRIVER = { userId: 'driver-1', role: 'DRIVER' };
const ADMIN = { userId: 'admin-1', role: 'ADMIN' };

function lookupResponse(data: Partial<UploadLookup>) {
  return of({ data } as AxiosResponse<UploadLookup>);
}

function httpError(status: number) {
  const error = new AxiosError(`Request failed with status ${status}`);
  error.response = {
    status,
    data: {},
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return throwError(() => error);
}

describe('UploadOwnershipService', () => {
  const env = { ...process.env };
  let get: jest.Mock;
  let service: UploadOwnershipService;

  const resolve = (params: Partial<ResolveFileRefParams>) =>
    service.resolveFileRef({
      field: 'log_book_v5',
      incoming: undefined,
      ownerUserId: 'driver-1',
      requester: DRIVER,
      ...params,
    });

  const publicUpload = (overrides: Partial<UploadLookup> = {}) => ({
    id: 'up-1',
    uploaderId: 'driver-1',
    service: null,
    resourceId: null,
    isPrivate: false,
    field: 'file',
    url: 'https://assets.gmrides.co.uk/uploads/up-1.pdf',
    ...overrides,
  });

  beforeEach(() => {
    process.env.BASE_API_URL = 'https://api.example.test';
    process.env.INTERNAL_API_KEY = 'internal-key';
    get = jest.fn();
    service = new UploadOwnershipService({ get } as unknown as HttpService);
  });

  afterAll(() => {
    process.env = env;
  });

  it('passes undefined and null through without a lookup', async () => {
    await expect(resolve({ incoming: undefined })).resolves.toBeUndefined();
    await expect(resolve({ incoming: null })).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("refuses another driver's upload (403)", async () => {
    get.mockReturnValue(lookupResponse(publicUpload({ uploaderId: 'other' })));
    await expect(
      resolve({ incoming: { id: 'up-1', url: 'https://x.test/a.pdf' } }),
    ).rejects.toThrow(ForbiddenException);
    expect(get).toHaveBeenCalledWith(
      'https://api.example.test/api/uploads/lookup-internal/up-1',
      { headers: { Authorization: 'Bearer internal-key' } },
    );
  });

  it("stores the driver's own upload with upload-service's url, not the client's", async () => {
    get.mockReturnValue(lookupResponse(publicUpload()));
    await expect(
      resolve({ incoming: { id: 'up-1', url: 'https://evil.test/fake.pdf' } }),
    ).resolves.toEqual({
      id: 'up-1',
      url: 'https://assets.gmrides.co.uk/uploads/up-1.pdf',
    });
  });

  it('stores a private upload as { id, isPrivate: true } with no url', async () => {
    get.mockReturnValue(
      lookupResponse(publicUpload({ isPrivate: true, url: null })),
    );
    await expect(resolve({ incoming: { id: 'up-1' } })).resolves.toEqual({
      id: 'up-1',
      isPrivate: true,
    });
  });

  it('lets an admin store any upload that exists', async () => {
    get.mockReturnValue(
      lookupResponse(publicUpload({ uploaderId: 'admin-1' })),
    );
    await expect(
      resolve({ incoming: { id: 'up-1', url: 'x' }, requester: ADMIN }),
    ).resolves.toEqual({
      id: 'up-1',
      url: 'https://assets.gmrides.co.uk/uploads/up-1.pdf',
    });
  });

  it('refuses an unknown upload id (400), even for an admin', async () => {
    get.mockReturnValue(httpError(404));
    await expect(
      resolve({ incoming: { id: 'nope' }, requester: ADMIN }),
    ).rejects.toThrow(BadRequestException);
  });

  it('fails closed when upload-service is down (503)', async () => {
    get.mockReturnValue(httpError(502));
    await expect(resolve({ incoming: { id: 'up-1' } })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('fails closed when BASE_API_URL or INTERNAL_API_KEY is missing', async () => {
    delete process.env.INTERNAL_API_KEY;
    await expect(resolve({ incoming: { id: 'up-1' } })).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('fails closed on a lookup for a different id', async () => {
    get.mockReturnValue(lookupResponse(publicUpload({ id: 'up-2' })));
    await expect(resolve({ incoming: { id: 'up-1' } })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('refuses a new reference with no upload id', async () => {
    await expect(
      resolve({ incoming: { url: 'https://x.test/someone-elses.pdf' } }),
    ).rejects.toThrow(BadRequestException);
    await expect(resolve({ incoming: {} })).rejects.toThrow(
      BadRequestException,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('refuses a value that is not an object', async () => {
    await expect(resolve({ incoming: 'https://x.test/a.pdf' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('keeps the stored reference when the same id is sent back', async () => {
    const existing = { id: 'up-1', isPrivate: true };
    await expect(
      resolve({
        incoming: { id: 'up-1', url: 'https://evil.test/x.pdf' },
        existing,
      }),
    ).resolves.toBe(existing);
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps an old stored reference with no id when its url is sent back', async () => {
    const existing = { url: 'https://assets.gmrides.co.uk/uploads/old.pdf' };
    await expect(
      resolve({
        incoming: { url: 'https://assets.gmrides.co.uk/uploads/old.pdf' },
        existing,
      }),
    ).resolves.toBe(existing);
    expect(get).not.toHaveBeenCalled();
  });

  describe('upload-service without url in the lookup (before its update)', () => {
    const withoutUrl: Partial<UploadLookup> = publicUpload();
    delete withoutUrl.url;

    it("falls back to the client's url for a public upload", async () => {
      get.mockReturnValue(lookupResponse(withoutUrl));
      await expect(
        resolve({ incoming: { id: 'up-1', url: 'https://x.test/a.pdf' } }),
      ).resolves.toEqual({ id: 'up-1', url: 'https://x.test/a.pdf' });
    });

    it('still checks the uploader', async () => {
      get.mockReturnValue(lookupResponse({ ...withoutUrl, uploaderId: 'x' }));
      await expect(
        resolve({ incoming: { id: 'up-1', url: 'https://x.test/a.pdf' } }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses a public upload with no url from either side', async () => {
      get.mockReturnValue(lookupResponse(withoutUrl));
      await expect(resolve({ incoming: { id: 'up-1' } })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('stores a private upload with no url', async () => {
      get.mockReturnValue(lookupResponse({ ...withoutUrl, isPrivate: true }));
      await expect(resolve({ incoming: { id: 'up-1' } })).resolves.toEqual({
        id: 'up-1',
        isPrivate: true,
      });
    });
  });
});
