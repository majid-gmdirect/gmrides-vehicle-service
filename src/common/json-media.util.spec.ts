import { pickMediaRef } from './json-media.util';

describe('pickMediaRef', () => {
  it('keeps a public reference', () => {
    expect(pickMediaRef({ id: ' up-1 ', url: 'https://x.test/a.pdf' })).toEqual(
      { url: 'https://x.test/a.pdf', id: 'up-1' },
    );
    expect(pickMediaRef('https://x.test/a.pdf')).toEqual({
      url: 'https://x.test/a.pdf',
    });
  });

  it('keeps a private reference, which has no url', () => {
    expect(pickMediaRef({ id: 'up-1', isPrivate: true })).toEqual({
      id: 'up-1',
      isPrivate: true,
    });
  });

  it('drops values that name no file', () => {
    expect(pickMediaRef(null)).toBeNull();
    expect(pickMediaRef('')).toBeNull();
    expect(pickMediaRef({ id: 'up-1' })).toBeNull();
    expect(pickMediaRef({ isPrivate: true })).toBeNull();
    expect(pickMediaRef({ id: '', url: '' })).toBeNull();
  });
});
