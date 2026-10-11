import { HttpService } from '@nestjs/axios';
import { ForbiddenException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DocumentStatus, VehicleDocumentKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadOwnershipService } from '../../common/upload-ownership.service';
import { VehicleDocumentChangeRequestService } from './vehicle-document-change-request.service';

const DRIVER = { userId: 'driver-1', role: 'DRIVER' };

describe('VehicleDocumentChangeRequestService: proposed documents', () => {
  let resolveFileRef: jest.Mock;
  let service: VehicleDocumentChangeRequestService;
  let createChangeRequest: jest.SpyInstance;

  const existing = {
    id: 'lb-1',
    vehicleId: 'veh-1',
    status: DocumentStatus.ACCEPTED,
    document: {
      id: 'old',
      url: 'https://assets.gmrides.co.uk/uploads/old.pdf',
    },
  };

  beforeEach(() => {
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'veh-1' }) },
      logBookV5: { findFirst: jest.fn().mockResolvedValue(existing) },
    };
    resolveFileRef = jest.fn();
    service = new VehicleDocumentChangeRequestService(
      prisma as unknown as PrismaService,
      {} as HttpService,
      {} as ClientProxy,
      { resolveFileRef } as unknown as UploadOwnershipService,
    );
    createChangeRequest = jest
      .spyOn(
        service as unknown as {
          createChangeRequest: (params: unknown) => Promise<unknown>;
        },
        'createChangeRequest',
      )
      .mockResolvedValue({ success: true });
  });

  it("refuses a change request that names another driver's upload", async () => {
    resolveFileRef.mockRejectedValue(new ForbiddenException());
    await expect(
      service.submitLogBookV5(
        'driver-1',
        'veh-1',
        'lb-1',
        { document: { id: 'other-driver', url: 'x' } },
        DRIVER,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(createChangeRequest).not.toHaveBeenCalled();
  });

  it('stores the checked reference in the payload, not the client value', async () => {
    resolveFileRef.mockResolvedValue({ id: 'new', isPrivate: true });

    await service.submitLogBookV5(
      'driver-1',
      'veh-1',
      'lb-1',
      { document: { id: 'new', url: 'https://evil.test/x.pdf' } },
      DRIVER,
    );

    expect(resolveFileRef).toHaveBeenCalledWith({
      field: 'log_book_v5',
      incoming: { id: 'new', url: 'https://evil.test/x.pdf' },
      ownerUserId: 'driver-1',
      requester: DRIVER,
      existing: existing.document,
    });
    expect(createChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: VehicleDocumentKind.LOG_BOOK_V5,
        payload: {
          document: { id: 'new', isPrivate: true },
          changedFields: ['document'],
        },
      }),
    );
  });
});
