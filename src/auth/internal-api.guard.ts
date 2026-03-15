// src/common/guards/internal-api.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InternalApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    console.log('🚨 Received Authorization header:', authHeader);
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      throw new UnauthorizedException('Unauthorized access to internal API');
    }

    return true;
  }
}
