export type PublicMediaRef = { id?: string; url: string };

export function pickPublicMediaRef(value: unknown): PublicMediaRef | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? { url: t } : null;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const url = o.url;
    if (typeof url === 'string' && url.length > 0) {
      const id = o.id;
      const out: PublicMediaRef = { url };
      if (typeof id === 'string' && id.trim()) out.id = id.trim();
      return out;
    }
  }
  return null;
}
