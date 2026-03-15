// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConstants } from './constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.publicKey,
      algorithms: [jwtConstants.algorithm],
    });
  }

  // src/auth/jwt.strategy.ts
  async validate(payload: any) {
    console.log('Raw JWT Payload:', payload);

    const user = {
      userId: payload.sub, // or payload.userId if your JWT contains it
      email: payload.email,
      role: payload.role,
    };

    console.log('Processed User:', user); // Debug
    return user;
  }
}
