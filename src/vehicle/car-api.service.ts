import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

type CacheEntry<T> = { expiresAt: number; value: T };

@Injectable()
export class CarApiService {
  private readonly cache = new Map<string, CacheEntry<any>>();

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private baseUrl() {
    return this.config.get<string>('CAR_API_BASE_URL') || 'https://carapi.app';
  }

  private ttlMs() {
    // car makes/models change rarely; keep short enough for safety
    return Number(this.config.get<string>('CAR_API_CACHE_TTL_MS') || 6 * 60 * 60 * 1000);
  }

  private timeoutMs() {
    return Number(this.config.get<string>('CAR_API_TIMEOUT_MS') || 8000);
  }

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private setCached<T>(key: string, value: T) {
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs() });
  }

  private normalizeQuery(q: string) {
    return q.trim().replace(/\s+/g, ' ');
  }

  /**
   * Uses CarAPI v2 JSON search with `like` operator to support partial matching.
   * Endpoint: /api/models/v2
   */
  private async searchModelsV2(filters: Array<{ field: string; op: string; val: any }>) {
    const url = `${this.baseUrl()}/api/models/v2`;
    const json = JSON.stringify(filters);

    const cacheKey = `modelsV2:${json}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    try {
      const res = await lastValueFrom(
        this.http.get(url, {
          params: { json, limit: 1000 },
          timeout: this.timeoutMs(),
          headers: { accept: 'application/json' },
        }),
      );
      const data = res?.data;
      this.setCached(cacheKey, data);
      return data;
    } catch {
      throw new ServiceUnavailableException('Car metadata service unavailable');
    }
  }

  async autocompleteMakes(query: string, limit: number): Promise<string[]> {
    const q = this.normalizeQuery(query);
    if (!q) return [];

    // CarAPI uses SQL-like patterns with `like`
    const filters = [{ field: 'make', op: 'like', val: `%${q}%` }];
    const payload = await this.searchModelsV2(filters);
    const rows: any[] = payload?.data ?? [];

    const unique: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const make = r?.make;
      if (typeof make !== 'string') continue;
      const key = make.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(key); // return lowercase for UI matching
      if (unique.length >= limit) break;
    }
    return unique;
  }

  async autocompleteModels(query: string, limit: number, make?: string): Promise<string[]> {
    const q = this.normalizeQuery(query);
    if (!q) return [];

    const filters: Array<{ field: string; op: string; val: any }> = [
      { field: 'name', op: 'like', val: `%${q}%` },
    ];
    if (make?.trim()) {
      // `=` provides exact make filter to reduce ambiguity
      filters.push({ field: 'make', op: '=', val: make.trim() });
    }

    const payload = await this.searchModelsV2(filters);
    const rows: any[] = payload?.data ?? [];

    const unique: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const name = r?.name;
      if (typeof name !== 'string') continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(key);
      if (unique.length >= limit) break;
    }
    return unique;
  }
}

