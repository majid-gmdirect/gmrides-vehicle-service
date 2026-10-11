import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

type Requester = { userId: string; role?: string };

/**
 * A file reference as vehicle-service stores it: `{ id, url }` for a file
 * in the public bucket, `{ id, isPrivate: true }` for one in the private
 * bucket (read through upload-service's `GET /api/uploads/:id/private-url`).
 */
export type StoredFileRef =
  | { id: string; url: string }
  | { id: string; isPrivate: true };

/**
 * What upload-service's `GET lookup-internal/:id` returns. `url` is null for
 * a private file. upload-service versions before 2026-10-11's follow-up
 * leave `url` out altogether.
 */
export type UploadLookup = {
  id: string;
  uploaderId: string | null;
  service: string | null;
  resourceId: string | null;
  isPrivate: boolean;
  field: string | null;
  url?: string | null;
};

export type ResolveFileRefParams = {
  /** Document name, for error messages (e.g. `log_book_v5`). */
  field: string;
  /** The value from the request body. */
  incoming: unknown;
  /** The driver the document belongs to (the route's `driverId`). */
  ownerUserId: string;
  requester: Requester;
  /** The value stored now, if any. An unchanged reference is kept as is. */
  existing?: unknown;
};

const VERIFY_FAILED = 'Could not verify the uploaded file. Please try again.';

/** The upload-service id inside a file reference (`{ id, ... }`), if any. */
export function uploadIdOf(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as Record<string, unknown>).id;
  if (typeof id !== 'string') return undefined;
  const trimmed = id.trim();
  return trimmed || undefined;
}

function urlOf(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const url = (value as Record<string, unknown>).url;
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  return trimmed || undefined;
}

/**
 * vehicle-service's side of the upload contract with upload-service.
 *
 * Vehicle documents and photos arrive from the client as `{ id, url }`, so
 * the id could name anybody's upload and the url could point anywhere.
 * Before a new reference is stored, `resolveFileRef` asks upload-service
 * who uploaded it:
 * - a driver may only store their own uploads; an admin may store any
 *   upload that exists (admins upload on drivers' behalf);
 * - the stored reference is rebuilt from upload-service's answer, so the
 *   client's url is never stored;
 * - a private upload is stored as `{ id, isPrivate: true }`, with no url.
 *
 * It fails closed: if upload-service can't answer, nothing is stored.
 */
@Injectable()
export class UploadOwnershipService {
  private readonly logger = new Logger(UploadOwnershipService.name);

  constructor(private readonly httpService: HttpService) {}

  private config(): {
    baseUrl: string;
    headers: Record<string, string>;
  } | null {
    const baseUrl = process.env.BASE_API_URL?.trim();
    const internalKey = process.env.INTERNAL_API_KEY?.trim();
    if (!baseUrl || !internalKey) return null;
    return {
      baseUrl,
      headers: { Authorization: `Bearer ${internalKey}` },
    };
  }

  /**
   * Returns the reference to store for `incoming`:
   * - `undefined` / `null` when the client sent that (field not sent /
   *   cleared), with nothing to check;
   * - the stored value unchanged when the client sent back the same upload
   *   id (or, for an old reference with no id, the same url);
   * - otherwise a reference built from upload-service's lookup, after the
   *   ownership check.
   *
   * A new reference without an upload id is refused: it can't be checked.
   */
  async resolveFileRef(
    params: ResolveFileRefParams,
  ): Promise<StoredFileRef | Record<string, unknown> | null | undefined> {
    const { field, incoming, ownerUserId, requester, existing } = params;
    if (incoming === undefined) return undefined;
    if (incoming === null) return null;
    if (typeof incoming !== 'object' || Array.isArray(incoming)) {
      throw new BadRequestException(
        `${field}: expected a file reference with an upload id`,
      );
    }

    const id = uploadIdOf(incoming);
    const existingRef =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : undefined;

    if (!id) {
      const url = urlOf(incoming);
      if (existingRef && url && url === urlOf(existingRef)) {
        return existingRef;
      }
      throw new BadRequestException(
        `${field}: the upload id is missing. Please upload the file again.`,
      );
    }

    if (existingRef && id === uploadIdOf(existingRef)) {
      return existingRef;
    }

    const upload = await this.lookup(id, field);

    if (requester.role !== 'ADMIN' && upload.uploaderId !== ownerUserId) {
      this.logger.warn(
        `Refused ${field} upload ${id} for driver ${ownerUserId}: uploaded by ${upload.uploaderId ?? 'nobody'}`,
      );
      throw new ForbiddenException(
        `${field}: this file was not uploaded from this account`,
      );
    }

    if (upload.isPrivate) {
      return { id, isPrivate: true };
    }

    if (typeof upload.url === 'string' && upload.url.trim()) {
      return { id, url: upload.url };
    }

    if (!('url' in upload)) {
      // upload-service from before the lookup returned `url`. Keep the old
      // behaviour (the client's url) for public files until it is deployed.
      const clientUrl = urlOf(incoming);
      if (clientUrl) {
        this.logger.warn(
          `upload-service lookup has no url for ${id}; storing the client's url`,
        );
        return { id, url: clientUrl };
      }
      throw new BadRequestException(
        `${field}: the file url is missing. Please upload the file again.`,
      );
    }

    this.logger.error(`Upload ${id} is public but has no url`);
    throw new ServiceUnavailableException(VERIFY_FAILED);
  }

  private async lookup(id: string, field: string): Promise<UploadLookup> {
    const config = this.config();
    if (!config) {
      this.logger.error(
        'BASE_API_URL or INTERNAL_API_KEY is not set; cannot verify uploads',
      );
      throw new ServiceUnavailableException(VERIFY_FAILED);
    }

    let data: UploadLookup | undefined;
    try {
      ({ data } = await firstValueFrom(
        this.httpService.get<UploadLookup>(
          `${config.baseUrl}/api/uploads/lookup-internal/${encodeURIComponent(id)}`,
          { headers: config.headers },
        ),
      ));
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new BadRequestException(
          `${field}: file not found. Please upload it again.`,
        );
      }
      this.logger.error(
        `Upload lookup failed for ${id}: ${isAxiosError(error) ? (error.response?.status ?? error.message) : String(error)}`,
      );
      throw new ServiceUnavailableException(VERIFY_FAILED);
    }

    if (!data || data.id !== id) {
      this.logger.error(`Upload lookup for ${id} returned an unexpected body`);
      throw new ServiceUnavailableException(VERIFY_FAILED);
    }
    return data;
  }
}
