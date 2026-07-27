// src/common/guards/internal-api.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class InternalApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      throw new UnauthorizedException('INTERNAL_API_KEY is not configured');
    }

    const expected = Buffer.from(`Bearer ${internalApiKey}`);
    const actual = Buffer.from(
      typeof authHeader === 'string' ? authHeader : '',
    );

    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new UnauthorizedException('Unauthorized access to internal API');
    }

    return true;
  }
}
