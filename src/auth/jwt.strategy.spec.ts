import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { RedisService } from '../redis/redis.service';

// constants.ts reads keys/public.pem when it is imported.
jest.mock('./constants', () => ({
  jwtConstants: { publicKey: 'test-public-key', algorithm: 'RS256' },
}));

describe('JwtStrategy', () => {
  let store: Map<string, string>;
  let redis: { get: jest.Mock<Promise<string | null>, [string]> };
  let strategy: JwtStrategy;

  const access = {
    sub: 'user-1',
    email: 'driver@example.com',
    role: 'DRIVER',
    jti: 'jti-1',
    typ: 'access',
  };

  beforeEach(() => {
    store = new Map([['session:jti-1', '1']]);
    redis = {
      get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    };
    strategy = new JwtStrategy(redis as unknown as RedisService);
  });

  it('accepts an access token whose session is live', async () => {
    await expect(strategy.validate(access)).resolves.toEqual({
      userId: 'user-1',
      email: 'driver@example.com',
      role: 'DRIVER',
      jti: 'jti-1',
    });
  });

  it('refuses a refresh token, even while its session is live', async () => {
    await expect(
      strategy.validate({ ...access, typ: 'refresh' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('refuses a tracking token', async () => {
    await expect(
      strategy.validate({ sub: 'user-1', role: 'DRIVER', typ: 'tracking' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('refuses a token with no typ', async () => {
    await expect(
      strategy.validate({ ...access, typ: undefined }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuses an access token with no jti', async () => {
    await expect(
      strategy.validate({ ...access, jti: undefined }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a blocked user', async () => {
    store.set('blocked:user-1', '1');
    await expect(strategy.validate(access)).rejects.toThrow('User is blocked');
  });

  it('refuses a revoked session', async () => {
    store.delete('session:jti-1');
    await expect(strategy.validate(access)).rejects.toThrow(
      'Session revoked or expired',
    );
  });
});
