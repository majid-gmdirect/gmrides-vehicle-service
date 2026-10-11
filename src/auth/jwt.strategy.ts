// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { jwtConstants } from './constants';
import { RedisService } from '../redis/redis.service';

interface AuthTokenPayload {
  sub?: string;
  email?: string;
  role?: string;
  jti?: string;
  typ?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly redis: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.publicKey,
      algorithms: [jwtConstants.algorithm],
    });
  }

  /**
   * auth-service signs access, refresh (30 days) and tracking tokens with
   * the same key and the same `sub`/`role`, so the signature alone proves
   * nothing about what a token is for. Only an access token (`typ:
   * 'access'`, with a `jti`) whose session is still live gets in. Same
   * checks as auth-service's own JwtStrategy.
   */
  async validate(payload: AuthTokenPayload) {
    if (payload?.typ !== 'access' || !payload?.jti) {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if user is blocked
    const blocked = await this.redis.get(`blocked:${payload.sub}`);

    if (blocked) {
      throw new UnauthorizedException('User is blocked');
    }

    // Check if session still exists
    const session = await this.redis.get(`session:${payload.jti}`);

    if (!session) {
      throw new UnauthorizedException('Session revoked or expired');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
