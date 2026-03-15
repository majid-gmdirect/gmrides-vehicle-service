// src/auth/jwt.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';

@Module({
  imports: [
    JwtModule.register({
      publicKey: jwtConstants.publicKey,
      verifyOptions: {
        algorithms: [jwtConstants.algorithm],
      },
    }),
  ],
  exports: [JwtModule],
})
export class JwtAuthModule {}
