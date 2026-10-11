/**
 * Express `trust proxy` list, the same as location-service's.
 *
 * The ThrottlerGuard counts requests by `req.ip`. Every request reaches the
 * container from a private address (nginx, then Docker's port mapping), so
 * without this all clients shared one bucket, and any one client could use
 * up the limit for everyone.
 *
 * Trust loopback and private hops, plus any public proxy listed in the
 * optional `TRUSTED_PROXY_IPS` (comma-separated; location-service sets the
 * box's own address there for the website's server-side calls). Express
 * takes the right-most `X-Forwarded-For` address it does not trust, so a
 * client cannot choose its bucket with a forged header.
 */
export function trustProxySetting(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const trustedProxyIps = (env.TRUSTED_PROXY_IPS ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  return ['loopback', 'linklocal', 'uniquelocal', ...trustedProxyIps];
}
