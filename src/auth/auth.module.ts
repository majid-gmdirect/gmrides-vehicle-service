// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), RedisModule],
  providers: [JwtStrategy, RolesGuard],
  exports: [PassportModule, RolesGuard, JwtStrategy],
})
export class AuthModule {}
