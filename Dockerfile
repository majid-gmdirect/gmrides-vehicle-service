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

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

USER node

EXPOSE 4002

CMD ["node", "dist/main.js"]
