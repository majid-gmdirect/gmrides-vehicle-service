export function toPayloadDateString(value: Date | null | undefined): string | null {
  if (value == null) return null;
  return value.toISOString().slice(0, 10);
}

export function toPrismaDateTime(value: string): Date {
  if (value.includes('T')) return new Date(value);
  return new Date(`${value}T00:00:00.000Z`);
}
