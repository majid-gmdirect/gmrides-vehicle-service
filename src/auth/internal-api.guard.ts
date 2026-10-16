// src/common/guards/internal-api.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/**
 * True when the request carries `Authorization: Bearer <INTERNAL_API_KEY>`.
 * False when the key isn't configured, so a missing key never matches.
 */
export function hasValidInternalApiKey(request: {
  headers: Record<string, unknown>;
}): boolean {
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) return false;

  const authHeader = request.headers['authorization'];
  const expected = Buffer.from(`Bearer ${internalApiKey}`);
  const actual = Buffer.from(typeof authHeader === 'string' ? authHeader : '');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

@Injectable()
export class InternalApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, unknown> }>();

    if (!process.env.INTERNAL_API_KEY) {
      throw new UnauthorizedException('INTERNAL_API_KEY is not configured');
    }

    if (!hasValidInternalApiKey(request)) {
      throw new UnauthorizedException('Unauthorized access to internal API');
    }

    return true;
  }
}
