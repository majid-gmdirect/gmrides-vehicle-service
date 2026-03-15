// src/auth/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  private readonly nginxHeaders = {
    trusted: 'x-trusted-gateway',
    role: 'x-user-role',
  };

  constructor(private reflector: Reflector) {}

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
    if (request.headers[this.nginxHeaders.trusted] === 'true') {
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
