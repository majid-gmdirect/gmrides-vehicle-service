import * as express from 'express';
import * as request from 'supertest';
import { trustProxySetting } from './trust-proxy';

/** An app that answers with the address Express (and so the throttler) sees. */
function appWith(env: NodeJS.ProcessEnv) {
  const app = express();
  app.set('trust proxy', trustProxySetting(env));
  app.get('/', (req, res) => {
    res.send(req.ip);
  });
  return app;
}

describe('trustProxySetting', () => {
  it('trusts private hops and adds TRUSTED_PROXY_IPS', () => {
    expect(trustProxySetting({})).toEqual([
      'loopback',
      'linklocal',
      'uniquelocal',
    ]);
    expect(
      trustProxySetting({ TRUSTED_PROXY_IPS: ' 95.216.138.15 , ,10.1.1.1' }),
    ).toEqual([
      'loopback',
      'linklocal',
      'uniquelocal',
      '95.216.138.15',
      '10.1.1.1',
    ]);
  });

  // supertest connects from 127.0.0.1, which plays the part of nginx.
  it('sees the client address that nginx forwards', async () => {
    const res = await request(appWith({}))
      .get('/')
      .set('X-Forwarded-For', '203.0.113.7');
    expect(res.text).toBe('203.0.113.7');
  });

  it('ignores an address the client forged in front of the real one', async () => {
    const res = await request(appWith({}))
      .get('/')
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.7');
    expect(res.text).toBe('203.0.113.7');
  });

  it('looks through a public proxy only when it is listed', async () => {
    const chain = '203.0.113.7, 95.216.138.15';

    const unlisted = await request(appWith({}))
      .get('/')
      .set('X-Forwarded-For', chain);
    expect(unlisted.text).toBe('95.216.138.15');

    const listed = await request(
      appWith({ TRUSTED_PROXY_IPS: '95.216.138.15' }),
    )
      .get('/')
      .set('X-Forwarded-For', chain);
    expect(listed.text).toBe('203.0.113.7');
  });
});
