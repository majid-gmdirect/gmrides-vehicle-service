import { hasValidInternalApiKey } from './internal-api.guard';

describe('hasValidInternalApiKey', () => {
  const original = process.env.INTERNAL_API_KEY;
  afterEach(() => {
    process.env.INTERNAL_API_KEY = original;
  });

  it('accepts the configured key', () => {
    process.env.INTERNAL_API_KEY = 'k1';
    expect(
      hasValidInternalApiKey({ headers: { authorization: 'Bearer k1' } }),
    ).toBe(true);
  });

  it('refuses a wrong or missing header', () => {
    process.env.INTERNAL_API_KEY = 'k1';
    expect(
      hasValidInternalApiKey({ headers: { authorization: 'Bearer k2' } }),
    ).toBe(false);
    expect(hasValidInternalApiKey({ headers: {} })).toBe(false);
  });

  it('never matches when no key is configured', () => {
    delete process.env.INTERNAL_API_KEY;
    expect(
      hasValidInternalApiKey({
        headers: { authorization: 'Bearer undefined' },
      }),
    ).toBe(false);
  });
});
