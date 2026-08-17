# syntax=docker/dockerfile:1
# ---- Build stage -----------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# This project uses Yarn Berry (nodeLinker: node-modules, lockfile format v8),
# but node:20-alpine ships Yarn Classic 1.x as the default global `yarn`.
# Corepack activates the exact Yarn version pinned in package.json so the
# lockfile is read correctly (Yarn Classic cannot parse a Berry lockfile).
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./

RUN yarn config set npmRegistryServer "https://registry.npmjs.org/"

# Cache mounts keep already-downloaded packages/engines across retries, so a
# transient network blip only costs re-fetching what actually failed instead
# of the whole dependency tree from scratch.
RUN --mount=type=cache,target=/root/.yarn/berry/cache --mount=type=cache,target=/root/.cache/prisma \
    yarn install --frozen-lockfile

COPY . .

RUN yarn prisma generate

RUN yarn build

# ---- Production stage --------------------------------------------------
FROM node:20-alpine AS production

ENV NODE_ENV=production
ENV COREPACK_HOME=/app/.corepack-cache

WORKDIR /app

# Needed so `yarn prisma migrate deploy` (run from deploy.sh) resolves the
# same Yarn Berry version as the build stage instead of the base image's
# default Yarn Classic. Prepared here (as root, with network access) so the
# non-root runtime user below never needs to download Yarn itself.
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack prepare --activate

# --chown sets ownership during the copy itself; a separate `chown -R /app`
# here would force BuildKit to duplicate all of node_modules into a new
# layer (copy-up on ownership change), roughly doubling image push time.
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/prisma ./prisma

RUN chown node:node /app && chown -R node:node /app/.corepack-cache package.json yarn.lock .yarnrc.yml

USER node

EXPOSE 4002

CMD ["node", "dist/main.js"]
