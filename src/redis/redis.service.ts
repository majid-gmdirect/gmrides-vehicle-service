// redis.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private connected = false;

  async onModuleInit() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = createClient({ url });

    this.client.on('error', (err) => {
      this.connected = false;
      this.logger.warn(`Redis error: ${String(err?.message ?? err)}`);
    });

    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log('Redis connected');
    } catch (err: any) {
      this.connected = false;
      this.logger.warn(
        `Redis not available (${url}). Continuing without Redis-backed auth checks.`,
      );
    }
  }

  // --- Basic String Commands ---
  async get(key: string): Promise<string | null> {
    if (!this.client || !this.connected) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client || !this.connected) return;
    if (ttlSeconds) {
      await this.client.set(key, value, { EX: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.connected) return;
    await this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    if (!this.client || !this.connected) return 0;
    return this.client.exists(key);
  }

  // --- Set Commands ---
  async sadd(key: string, value: string): Promise<number> {
    if (!this.client || !this.connected) return 0;
    return this.client.sAdd(key, value); // note redis v4 uses sAdd
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.client || !this.connected) return [];
    return this.client.sMembers(key);
  }

  async srem(key: string, value: string): Promise<number> {
    if (!this.client || !this.connected) return 0;
    return this.client.sRem(key, value);
  }

  // --- Expire ---
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client || !this.connected) return false;
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }
}
