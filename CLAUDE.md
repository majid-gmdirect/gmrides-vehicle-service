# vehicle-service

See [root CLAUDE.md](../CLAUDE.md) for cross-service architecture and conventions.

## Keeping This File Current

Update this file as part of any work that touches vehicle-service — not as a
follow-up task. If you notice something here that's gone stale (a moved file,
a changed env var, a fixed "Known Issue"), fix it in the same change, on sight.

## Purpose

NestJS service that owns vehicle records and their compliance documents for
drivers: vehicle profiles, images, MOT/inspection records, insurance, PCO
licensing docs, log book (V5), permission letters, and driver-submitted
change requests to any of the above, with an admin review workflow. This
repo also contains leftover strings suggesting it was cloned from a
user-service template — treat any such naming as historical, not functional.

## Commands

```bash
yarn seed              # ts-node prisma/seed.ts
yarn build              # nest build
yarn format             # prettier --write "src/**/*.ts" "test/**/*.ts"
yarn start               # nest start
yarn start:dev           # nest start --watch
yarn start:debug         # nest start --debug --watch
yarn start:prod          # node dist/main
yarn lint                # eslint "{src,apps,libs,test}/**/*.ts" --fix
yarn test                # jest
yarn test:watch          # jest --watch
yarn test:cov            # jest --coverage
yarn test:debug          # node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand
yarn test:e2e            # jest --config ./test/jest-e2e.json
```

Prisma (not in package.json scripts, invoked directly): `yarn prisma generate`,
`yarn prisma migrate deploy` (used by `deploy.sh`).

## Tech Stack

- Node 20 (alpine, per Dockerfile), Yarn Berry `4.13.0` (`packageManager` field;
  Corepack-activated in Docker build since the base image ships Yarn Classic)
- NestJS `^11.0.1` (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`)
- Prisma `6.9.0` (`@prisma/client` + `prisma`), PostgreSQL via `DATABASE_URL`
- `@nestjs/jwt` `^11.0.0` + `passport-jwt` `^4.0.1` for RS256 JWT verification
- `@nestjs/microservices` `11.0.1` + `amqplib`/`amqp-connection-manager` for RabbitMQ
- `redis` `^5.11.0` (node-redis v4+ client API) for session/blocklist checks
- `@nestjs/throttler` `^6.5.0` for global rate limiting
- `@nestjs/swagger` `^11.2.0` + `swagger-ui-express`, gated behind basic auth in prod
- `helmet` `^8.3.0` for security headers
- TypeScript `^5.7.3`, Jest `^29.7.0` / ts-jest for tests

## Structure

```
src/
  auth/           JWT strategy/guards, roles guard, internal-API guard, RSA public key loading
  common/          Cross-cutting utils: document-expiry/status helpers, notification senders,
                    vehicle/document "change request" payload + mutation policy helpers
  prisma/          PrismaService + module (DB access)
  redis/           RedisService + module (session/blocklist store)
  vehicle/
    controllers/    One controller per resource x audience, e.g.
                     driver-vehicles, admin-vehicles, vehicle-images,
                     vehicle-inspections, vehicle-insurances, vehicle-pco-docs,
                     vehicle-permission-letters, vehicle-log-book-v5,
                     vehicle-schedules, vehicle-meta (car make/model autocomplete),
                     driver-document-status, internal-driver-documents,
                     internal-change-requests (each with an admin-* counterpart
                     where relevant)
    dto/            Request/response DTOs (class-validator decorated)
    decorators/      Swagger decorator bundles for controllers
    document-change-request/   Driver-submitted edits to an existing document
    vehicle-change-request/    Driver-submitted edits to the vehicle profile itself
    vehicle.module.ts, vehicle.service.ts, car-api.service.ts (external car
      make/model lookup)
prisma/
  schema.prisma, migrations/, dbml/schema.dbml, seed.ts
```

Global route prefix: `api/vehicles` (set in `main.ts`).

## Data Model

(Prisma models, one line each — see `prisma/schema.prisma` for full detail.)

- `Vehicle` — a driver's vehicle profile (make/model/plate/type, approval &
  active/deleted flags); `driverId` references a driver in the user-service,
  not a local FK.
- `VehicleImage` — photos attached to a vehicle (front/back/interior/plate/etc).
- `LogBookV5` — UK V5C log book document + review status.
- `VehicleInspection` — MOT/safety/emissions/etc. inspection record + expiry.
- `VehicleInsurance` — insurance policy document + validity window.
- `VehiclePcoDocument` — PCO licensing/badge document.
- `PermissionLetter` — optional permission-letter document (required only
  when admin sets `requiestOptionalDocuments` — note the typo is in the schema
  itself, not a doc error).
- `VehicleSchedule` — optional vehicle-schedule document (same conditional
  requirement as above).
- `VehicleDocumentChangeRequest` — driver-proposed edit to one existing
  document, pending admin review.
- `VehicleChangeRequest` — driver-proposed edit to the vehicle profile itself,
  pending admin review.

All document models share the same shape: `status` (`ACCEPTED`/`REJECTED`/
`PENDING`), `rejectedReason`, and a `document` JSON blob (file ref, not raw
bytes).

## Auth Approach

- Primary: RS256 JWT, verified with a public key loaded from
  `keys/public.pem` at process start (`src/auth/constants.ts` — throws at
  boot if the file is missing). Matches root convention: auth-service issues,
  this service only verifies (no private key present).
- `JwtStrategy` (`passport-jwt`) additionally checks Redis on every request:
  `blocked:{sub}` (user blocklist) and `session:{jti}` (session must still
  exist) — so revocation is enforced via a shared Redis instance, not just
  token expiry.
- Global guard chain (`app.module.ts`, `APP_GUARD` order): `JwtAuthGuard` →
  `RolesGuard` → `ThrottlerGuard`. Route-level `@Roles('ADMIN')` etc. drives
  `RolesGuard`; `@Public()` skips auth entirely.
- Secondary "trusted gateway" path: if `GATEWAY_SHARED_SECRET` is set and a
  request carries `x-trusted-gateway: true` plus a matching
  `x-gateway-signature` (constant-time compared), `JwtAuthGuard`/`RolesGuard`
  trust `x-user-id` / `x-user-role` / `x-user-email` headers directly instead
  of verifying a JWT — presumably for an nginx/gateway layer sitting in front
  of this service. Disabled entirely when the secret isn't configured.
- Separate internal-service path: routes under `internal/*` use
  `@InternalRoute()` (`Public()` + `InternalApiGuard`), which requires
  `Authorization: Bearer <INTERNAL_API_KEY>` — independent of the JWT/gateway
  flows above.

## Integration Points

- **Inbound, JWT**: expects RS256 tokens issued by auth-service; verifies
  with `keys/public.pem` (root-mounted read-only at `/app/keys` in deploy).
- **Inbound, internal API**: exposes `internal/driver/*` (expired/expiring
  document driver IDs, per-driver document status/expiry, delete/archive/
  restore all vehicles for a driver) and `internal/change-requests/summaries`,
  both `@ApiExcludeController()` and guarded by `INTERNAL_API_KEY` — built for
  another backend service (e.g. a scheduler or user-service) to call, not the
  public API.
- **Outbound, HTTP to user-service (inferred)**: calls
  `${BASE_API_URL}/api/users/main/internal/...` (admin-ids lookup, driver
  existence/role check, driver search-by-name) with
  `Authorization: Bearer ${INTERNAL_API_KEY}`. Path prefix (`/api/users/...`)
  and error message ("Internal user-service auth failed") indicate this
  targets user-service, likely through a shared gateway/base URL rather than
  a direct service address.
- **Outbound, RabbitMQ**: emits `create-notification` events to a
  `notification_queue` (via `ClientsModule` client `NOTIFICATION_SERVICE`)
  when a driver submits a vehicle/document change request — presumably
  consumed by a notification-service.
- **Inbound, RabbitMQ**: `main.ts` connects a microservice listener on queue
  `vehicle_queue`, but no `@EventPattern`/`@MessagePattern` handler exists
  anywhere in `src/` — this consumer currently has nothing to dispatch to
  (see Known Issues).
- **Outbound, third-party**: `CarApiService` calls an external car
  make/model metadata API at `CAR_API_BASE_URL` (defaults to
  `https://carapi.app`), in-memory cached (`CAR_API_CACHE_TTL_MS`, default
  6h). Not a GM Rides service.
- **Shared Redis**: reads `blocked:{sub}` / `session:{jti}` keys that some
  other service (likely auth-service) is expected to write — confirms a
  shared Redis instance/convention across services, not just a local cache.
- Env vars referenced in code (names only — see `.env`, not schema-validated
  so no `.env.example` to cross-check against): `DATABASE_URL`, `PORT`,
  `NODE_ENV`, `RABBIT_MQ_URL`, `REDIS_URL`, `BASE_API_URL`,
  `INTERNAL_API_KEY`, `GATEWAY_SHARED_SECRET`, `ENABLE_SWAGGER`,
  `SWAGGER_USER`, `SWAGGER_PASSWORD`, `CAR_API_BASE_URL`,
  `CAR_API_CACHE_TTL_MS`, `CAR_API_TIMEOUT_MS`.

## Known Issues

(Update this list as items are fixed.)

- Stray `package-lock.json` sits alongside `yarn.lock` — yarn is the
  canonical package manager repo-wide; don't delete without checking why it
  exists first.
- No `.env.example` despite a real `.env` being present — new env vars have
  to be discovered by grepping `process.env`/`config.get` in `src/`.
- Port configuration is inconsistent across files: `main.ts` falls back to
  `PORT ?? 4002`, `Dockerfile` `EXPOSE`s 4002, `ecosystem.config.js` (pm2,
  not tracked in git — see below) sets `PORT=4013` with a comment about
  avoiding collision with user-service (4002) and appointment-service
  (4012), while the shared `docker-compose.yml` maps host `4010` →
  container `3000`. Actual effective port is whatever `.env` sets; worth
  reconciling the comments/fallbacks so they don't mislead.
- `deploy.sh` (present locally, but gitignored — not committed) is a
  copy-paste from another service: it echoes "Restarting Auth Service with
  PM2" and runs `pm2 restart user-service`, not `vehicle-service`. Looks
  stale/non-functional as a deploy script for this service.
- `ecosystem.config.js` (pm2 config) is also gitignored/local-only, and
  describes a pm2-based deploy path that conflicts with the docker-compose
  deploy path documented at the root level. Unclear which is authoritative,
  or whether pm2 is a legacy leftover.
- RabbitMQ consumer on `vehicle_queue` is wired up in `main.ts` but has no
  `@EventPattern`/`@MessagePattern` handlers anywhere — dead/unused inbound
  queue as of this writing.
- `src/auth/jwt.strategy.ts` has a leftover `console.log('Raw JWT Payload:',
  payload)` that logs the full decoded JWT payload (including email) on
  every authenticated request.
- `fs` (`^0.0.1-security`) and `path` (`^0.12.7`) are listed as npm
  dependencies in `package.json` — both are Node.js built-ins; these are
  unnecessary third-party packages shadowing core modules (`fs@0.0.1-security`
  in particular is a known placeholder/security-squat package on npm) and
  are candidates for removal.
- `.gitignore` references a `.DOCUMENTATION.md` file that doesn't exist
  anywhere in the repo — either a dead entry or a doc file that was lost
  before being committed.
- `PermissionLetter`/`VehicleSchedule` conditional-requirement flag on
  `Vehicle` is named `requiestOptionalDocuments` (typo for "require") —
  it's a real Prisma column name, so fixing it means a migration, not just
  a rename.
- `README.md` was 100% unmodified NestJS starter boilerplate (plus two
  stray heading lines, `# gmrides-user-service` / `# gmrides-vehicle-service`,
  hinting this repo was cloned from a user-service template) — it has been
  deleted; this file replaces it.
