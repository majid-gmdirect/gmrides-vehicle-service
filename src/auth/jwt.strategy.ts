// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { jwtConstants } from './constants';
import { RedisService } from '../redis/redis.service';

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

  async validate(payload: any) {
    console.log('Raw JWT Payload:', payload);

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
