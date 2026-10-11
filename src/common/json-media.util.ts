/**
 * A stored file reference: public `{ id?, url }`, or private
 * `{ id, isPrivate: true }` with no url (read through upload-service's
 * `GET /api/uploads/:id/private-url`).
 */
export type MediaRef =
  | { id?: string; url: string }
  | { id: string; isPrivate: true };

export function pickMediaRef(value: unknown): MediaRef | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? { url: t } : null;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : null;
    const url = o.url;
    if (typeof url === 'string' && url.length > 0) {
      const out: { id?: string; url: string } = { url };
      if (id) out.id = id;
      return out;
    }
    if (o.isPrivate === true && id) {
      return { id, isPrivate: true };
    }
  }
  return null;
}
