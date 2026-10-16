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

One-off (see "Uploaded files" below), on the server after upload-service has
`move-to-private-internal`:

```bash
docker exec vehicle-service node dist/scripts/move-vehicle-documents-to-private.js          # dry run
docker exec vehicle-service node dist/scripts/move-vehicle-documents-to-private.js --apply  # do it
```

## Tech Stack

- **Node 22 LTS** in the image (`node:22-alpine`, both Dockerfile stages,
  since 2026-10-11; was `node:20-alpine`, end of life April 2026). Node 22
  reaches end of life on 2027-04-30, so Node 24 is the next move. No
  `engines` field in `package.json`. No dependency here compiles native
  code: Prisma's engines are Node-API libraries picked by `prisma generate`
  in the build stage (a `linux-musl…-openssl-3.0.x` target), so a Node major
  change needs no rebuild of them.
- Yarn Berry `4.13.0` (`packageManager` field; Corepack-activated in Docker
  build since the base image ships Yarn Classic)
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
                    vehicle/document "change request" payload + mutation policy helpers,
                    upload-ownership.service.ts (upload-service lookups),
                    trust-proxy.ts (rate-limit client address)
  scripts/         One-off CLI scripts, built to dist/scripts/ (kept under src/ so
                    dist/main.js stays where the Dockerfile expects it)
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
bytes). A file ref is `{ id, url }` for a file in upload-service's public
bucket, or `{ id, isPrivate: true }` (no url) for one in the private bucket.
Older rows may hold a bare `{ url }`. `VehicleImage.image` and
`Vehicle.permission_letter` / `vehicle_schedule` hold the same shape.

## Auth Approach

- Primary: RS256 JWT, verified with a public key loaded from
  `keys/public.pem` at process start (`src/auth/constants.ts` — throws at
  boot if the file is missing). Matches root convention: auth-service issues,
  this service only verifies (no private key present).
- `JwtStrategy` (`passport-jwt`) first accepts only `typ: 'access'` with a
  `jti` (since 2026-10-11: auth-service signs refresh and tracking tokens with
  the same key), then checks Redis on every request: `blocked:{sub}` (user
  blocklist) and `session:{jti}` (session must still exist) — so revocation is
  enforced via a shared Redis instance, not just token expiry.
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

## Rate Limiting

Global `ThrottlerGuard`, 100 requests a minute, keyed on `req.ip`. Since
2026-10-11 `main.ts` sets Express `trust proxy` from
`src/common/trust-proxy.ts` (copied from location-service): loopback,
link-local and private hops, plus the optional comma-separated
`TRUSTED_PROXY_IPS`. So `req.ip` is the client nginx forwards, and a forged
`X-Forwarded-For` can't choose the bucket. Before that every client shared
one bucket (the Docker gateway address).

**Calls with a valid `INTERNAL_API_KEY` are not counted** (since 2026-10-16,
`skipIf` in `app.module.ts`, `hasValidInternalApiKey` in
`auth/internal-api.guard.ts`, as in user- and upload-service). The other
services all reach this one from the same address, and booking-service looks
up a driver's vehicle (`internal/driver/:id/document-status`) for each
booking it returns. On 2026-10-16 those lookups passed 100 a minute, got
429, and bookings came back without their vehicle.

## Uploaded files

Clients upload to upload-service (`POST /api/uploads`, multipart `file`, plus
an optional `field` naming the document type, which sends compliance
documents to the private bucket), then send the reference here.

**Ownership check (since 2026-10-11).** `UploadOwnershipService.resolveFileRef`
runs before any new file reference is stored: vehicle create/update
(`permission_letter`, `vehicle_schedule`), photos, inspections, insurances,
PCO documents, log books, permission letters, schedules, and the driver's
document and vehicle change requests (so the payload an admin approves is
already checked).

- It calls upload-service's `GET /api/uploads/lookup-internal/:id` over
  `BASE_API_URL` with `INTERNAL_API_KEY`.
- A driver may store only uploads whose `uploaderId` is the driver (403). An
  admin may store any upload that exists. Unknown id: 400.
- The stored ref is rebuilt from the lookup: `{ id, url }` with
  upload-service's url, or `{ id, isPrivate: true }`. The client's url is
  never stored. (While upload-service's lookup has no `url` field yet, a
  public file keeps the client's url, as before.)
- It fails closed: upload-service down, or `BASE_API_URL` / `INTERNAL_API_KEY`
  unset, gives 503 and nothing is stored.
- An unchanged ref (same id as stored, or same url for an old ref with no id)
  is kept as stored, without a lookup. A new ref with no id is refused (400).
- `pickMediaRef` (`common/json-media.util.ts`) keeps private refs; the log
  book and vehicle file DTOs accept `{ id }` with no `url`, and `isPrivate`.

**Moving existing documents to the private bucket.**
`src/scripts/move-vehicle-documents-to-private.ts` (commands above) finds
every compliance ref with a public url, calls upload-service's
`POST /api/uploads/move-to-private-internal/:id` with the document type as
`{ field }`, and rewrites each ref to that upload to `{ id, isPrivate: true }`.

- It covers the six document tables, `Vehicle.permission_letter` /
  `vehicle_schedule`, and change-request payloads (all statuses).
- A bare `{ url }` ref is matched to its upload through
  `GET lookup-by-url-internal?url=`; without a match it is listed and left.
- Vehicle photos stay public; an upload also used by a photo is skipped.
- Dry run by default. Idempotent. A row is rewritten only if it still holds
  what was read.
- It prints the old public URLs to purge from the Cloudflare cache.

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
- **Outbound, HTTP to upload-service**: `GET /api/uploads/lookup-internal/:id`
  before storing a file ref (see "Uploaded files"); the one-off script also
  calls `move-to-private-internal/:id` and `lookup-by-url-internal`. Over
  `BASE_API_URL` with `INTERNAL_API_KEY`; upload-service exempts internal-key
  calls from its throttle.
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
  `CAR_API_CACHE_TTL_MS`, `CAR_API_TIMEOUT_MS`, `TRUSTED_PROXY_IPS`
  (optional).

## Known Issues

(Update this list as items are fixed.)

- **Merging the Node 22 change does not deploy it.** Production runs the
  Node 20 image until vehicle-service is redeployed from the console.
  Nothing in the database or config changes, so rolling back means
  redeploying the previous commit (`ALLOW_REVERT=1`). Remove this item once
  production runs the Node 22 image.
- **`prisma migrate deploy` fails on an empty database** (found 2026-10-11
  on a throwaway local Postgres). Two migrations are out of order:
  `20260518054248_added_vehicle_changes_req` renames the index
  `VehicleDocumentChangeRequest_targetType_targetDocumentId_s_idx`, which
  `20260518120000_vehicle_document_change_requests` creates later the same
  day. Existing databases got them in the order they were written, so
  deploys there are unaffected (not checked on the servers). A new database
  (a fresh staging, a local copy) stops at the
  rename with "relation ... does not exist". `yarn prisma db push` builds
  the current schema without the history; don't edit applied migrations
  without a plan for `_prisma_migrations` checksums.
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
- **Clients can't show private files yet** (checked 2026-10-11). The panel
  lists a document only if `document.url` is set
  (`components/driver-vehicles/dialogs/details.tsx`) and its form schema
  requires a url (`components/driver-vehicles/validation/documentStep.ts`).
  The driver app's models read a missing url as `''`. Both need to fetch
  `GET /api/uploads/:id/private-url` for `isPrivate` refs before the
  migration script is run with `--apply`.
- **A driver can't open a private file an admin uploaded for them**:
  upload-service's `private-url` allows only the uploader or an admin.
- **Change requests submitted before 2026-10-11** were not ownership-checked;
  approving one applies its stored refs as they are.
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
