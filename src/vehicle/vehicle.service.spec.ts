import { HttpService } from '@nestjs/axios';
import { ForbiddenException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DocumentStatus } from '@prisma/client';
import { AxiosError, AxiosHeaders } from 'axios';
import { of, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { UploadOwnershipService } from '../common/upload-ownership.service';
import { VehicleService } from './vehicle.service';

const DRIVER = { userId: 'driver-1', role: 'DRIVER' };
const ADMIN = { userId: 'admin-1', role: 'ADMIN' };
const PUBLIC_URL = 'https://assets.gmrides.co.uk/uploads';

type Upload = { uploaderId: string; isPrivate: boolean };

/** upload-service's lookup answers, by upload id. */
const uploads: Record<string, Upload> = {
  'own-public': { uploaderId: 'driver-1', isPrivate: false },
  'own-private': { uploaderId: 'driver-1', isPrivate: true },
  'other-driver': { uploaderId: 'driver-2', isPrivate: true },
  'admin-upload': { uploaderId: 'admin-1', isPrivate: false },
};

function notFound() {
  const error = new AxiosError('Not found');
  error.response = {
    status: 404,
    data: {},
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return throwError(() => error);
}

describe('VehicleService: uploaded file references', () => {
  const env = { ...process.env };
  let get: jest.Mock;
  let prisma: {
    vehicle: { findFirst: jest.Mock };
    logBookV5: { create: jest.Mock };
    vehicleImage: { create: jest.Mock };
    vehicleInspection: { findFirst: jest.Mock; update: jest.Mock };
    vehicleDocumentChangeRequest: { findMany: jest.Mock };
  };
  let service: VehicleService;

  beforeEach(() => {
    process.env.BASE_API_URL = 'https://api.example.test';
    process.env.INTERNAL_API_KEY = 'internal-key';

    get = jest.fn((url: string) => {
      if (url.includes('/api/users/main/role-by-id/')) {
        return of({ data: { role: 'DRIVER', hasDriverProfile: true } });
      }
      const id = decodeURIComponent(url.split('/lookup-internal/')[1] ?? '');
      const upload = uploads[id];
      if (!upload) return notFound();
      return of({
        data: {
          id,
          service: null,
          resourceId: null,
          field: 'file',
          ...upload,
          url: upload.isPrivate ? null : `${PUBLIC_URL}/${id}.pdf`,
        },
      });
    });
    const http = { get } as unknown as HttpService;

    prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'veh-1' }),
      },
      logBookV5: {
        create: jest.fn((args: { data: unknown }) =>
          Promise.resolve({ id: 'lb-1', ...(args.data as object) }),
        ),
      },
      vehicleImage: {
        create: jest.fn((args: { data: unknown }) =>
          Promise.resolve({ id: 'img-1', ...(args.data as object) }),
        ),
      },
      vehicleInspection: {
        findFirst: jest.fn(),
        update: jest.fn((args: { data: unknown }) =>
          Promise.resolve({ id: 'insp-1', ...(args.data as object) }),
        ),
      },
      vehicleDocumentChangeRequest: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new VehicleService(
      prisma as unknown as PrismaService,
      http,
      { emit: jest.fn() } as unknown as ClientProxy,
      new UploadOwnershipService(http),
    );
  });

  afterAll(() => {
    process.env = env;
  });

  it("refuses to store another driver's upload as a log book", async () => {
    await expect(
      service.createLogBookV5(
        'driver-1',
        'veh-1',
        { document: { id: 'other-driver', url: 'https://x.test/v5.pdf' } },
        DRIVER,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.logBookV5.create).not.toHaveBeenCalled();
  });

  it("stores the driver's own upload with upload-service's url", async () => {
    await service.createLogBookV5(
      'driver-1',
      'veh-1',
      { document: { id: 'own-public', url: 'https://evil.test/fake.pdf' } },
      DRIVER,
    );
    expect(prisma.logBookV5.create).toHaveBeenCalledWith({
      data: {
        vehicleId: 'veh-1',
        document: { id: 'own-public', url: `${PUBLIC_URL}/own-public.pdf` },
      },
    });
  });

  it('stores a private upload with no url', async () => {
    await service.createLogBookV5(
      'driver-1',
      'veh-1',
      { document: { id: 'own-private' } },
      DRIVER,
    );
    expect(prisma.logBookV5.create).toHaveBeenCalledWith({
      data: {
        vehicleId: 'veh-1',
        document: { id: 'own-private', isPrivate: true },
      },
    });
  });

  it('lets an admin store an upload they made for the driver', async () => {
    await service.addImage(
      'driver-1',
      'veh-1',
      { type: 'front', image: { id: 'admin-upload', url: 'x' } },
      ADMIN,
    );
    expect(prisma.vehicleImage.create).toHaveBeenCalledWith({
      data: {
        vehicleId: 'veh-1',
        type: 'front',
        image: { id: 'admin-upload', url: `${PUBLIC_URL}/admin-upload.pdf` },
      },
    });
  });

  it('keeps an unchanged document without asking upload-service', async () => {
    const stored = { id: 'old-upload', isPrivate: true };
    prisma.vehicleInspection.findFirst.mockResolvedValue({
      id: 'insp-1',
      status: DocumentStatus.PENDING,
      document: stored,
    });

    await service.updateInspection(
      'driver-1',
      'veh-1',
      'insp-1',
      { document: { id: 'old-upload', url: 'https://evil.test/x.pdf' } },
      DRIVER,
    );

    const lookups = get.mock.calls.filter(([url]: [string]) =>
      url.includes('lookup-internal'),
    );
    expect(lookups).toHaveLength(0);
    const [[args]] = prisma.vehicleInspection.update.mock.calls as [
      [{ data: { document: unknown } }],
    ];
    expect(args.data.document).toBe(stored);
  });
});
