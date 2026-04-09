// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { RolesGuard } from './roles.guard';
import { JwtStrategy } from './jwt.strategy';

import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    RedisModule,
  ],

  providers: [RolesGuard, JwtStrategy],

  exports: [PassportModule, RolesGuard, JwtStrategy],
})
export class AuthModule {}
