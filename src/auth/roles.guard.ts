// src/auth/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  private readonly nginxHeaders = {
    trusted: 'x-trusted-gateway',
    role: 'x-user-role',
    signature: 'x-gateway-signature',
  };

  constructor(private reflector: Reflector) {}

  /**
   * Mirrors JwtAuthGuard.isTrustedGateway: the trusted-gateway header flow is
   * only honored when GATEWAY_SHARED_SECRET is configured and the request
   * presents a matching x-gateway-signature header (constant-time compare).
   */
  private isTrustedGateway(request: any): boolean {
    const secret = process.env.GATEWAY_SHARED_SECRET;
    if (!secret) return false;
    if (request.headers[this.nginxHeaders.trusted] !== 'true') return false;

    const provided = request.headers[this.nginxHeaders.signature];
    if (typeof provided !== 'string' || provided.length === 0) return false;

    const expected = Buffer.from(secret);
    const actual = Buffer.from(provided);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      this.logger.debug('No role requirements for this route');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 1. Check Nginx trusted headers flow
    if (this.isTrustedGateway(request)) {
      this.logger.log('🔐 Using Nginx header authentication');
      const nginxRole = request.headers[this.nginxHeaders.role];

      if (!nginxRole) {
        this.logger.error('Nginx headers missing required role');
        throw new ForbiddenException('Missing role in trusted headers');
      }

      this.logger.debug(`Nginx provided role: ${nginxRole}`);
      return requiredRoles.includes(nginxRole);
    }

    // 2. JWT flow (using already verified user from JwtAuthGuard)
    this.logger.log('🔐 Using JWT role validation');

    if (!user) {
      this.logger.error('No user found - JwtAuthGuard may have failed');
      throw new ForbiddenException('Authentication required');
    }

    if (!user.role) {
      this.logger.error('User has no role assigned', { userId: user.userId });
      throw new ForbiddenException('No role assigned to user');
    }

    this.logger.debug(
      `User role: ${user.role}, Required: ${requiredRoles.join(', ')}`,
    );

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
