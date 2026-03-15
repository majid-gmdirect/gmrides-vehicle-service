// src/auth/jwt-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly nginxHeaders = {
    trusted: 'x-trusted-gateway',
    userId: 'x-user-id',
    role: 'x-user-role',
    email: 'x-user-email',
  };
  constructor(private readonly reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    // 🔓 PUBLIC ROUTE CHECK (added, nothing else touched)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.log('🔓 Public route, skipping authentication');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    this.logger.verbose(`Incoming request to ${request.url}`);
    this.logger.debug('Request headers:', {
      auth: !!request.headers.authorization,
      trustedGateway: !!request.headers[this.nginxHeaders.trusted],
      userIdHeader: !!request.headers[this.nginxHeaders.userId],
      roleHeader: !!request.headers[this.nginxHeaders.role],
    });

    // Nginx trusted flow
    if (request.headers[this.nginxHeaders.trusted] === 'true') {
      this.logger.log(
        '🔐 Authentication Method: TRUSTED GATEWAY (Nginx headers)',
      );
      request.user = {
        userId: request.headers[this.nginxHeaders.userId],
        email: request.headers[this.nginxHeaders.email] || null,
        role: request.headers[this.nginxHeaders.role],
        fromTrustedGateway: true,
      };
      this.logger.debug('User created from Nginx headers:', {
        userId: request.user.userId,
        role: request.user.role,
      });
      return true;
    }

    // JWT flow
    this.logger.log('🔐 Authentication Method: JWT');
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();

      this.logger.error('Authentication FAILED', {
        error: err?.message,
        info: info?.message,
        url: request.url,
      });

      // Handle specific JWT errors
      if (info?.message === 'jwt expired') {
        throw new UnauthorizedException('Token has expired');
      }
      if (info?.message === 'No auth token') {
        throw new UnauthorizedException('No authentication token provided');
      }
      if (info?.message?.includes('invalid token')) {
        throw new UnauthorizedException('Invalid token');
      }

      // Generic error fallback
      throw new UnauthorizedException('Authentication failed');
    }

    this.logger.log(
      `✅ Authenticated ${user.fromTrustedGateway ? 'via Nginx' : 'via JWT'}`,
      {
        userId: user.userId,
        role: user.role,
        method: user.fromTrustedGateway ? 'HEADER' : 'JWT',
      },
    );

    return user;
  }
}
