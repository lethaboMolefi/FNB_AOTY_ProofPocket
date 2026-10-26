# ProofPocket API for Cloud Run. Build context: system/
FROM node:26.12.1-slim AS build
WORKDIR /src
RUN npm install -g pnpm@12.15.0
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@proofpocket/api..."
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @proofpocket/api build

# Production dependencies only.
FROM node:26.12.1-slim AS deps
WORKDIR /src
RUN npm install -g pnpm@12.15.0
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter "@proofpocket/api..."

FROM node:26.12.1-slim
ENV NODE_ENV=production
WORKDIR /srv
COPY --from=deps /src/node_modules ./node_modules
COPY --from=deps /src/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /src/apps/api/dist ./apps/api/dist
COPY --from=build /src/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /src/apps/api/uml ./apps/api/uml
COPY --from=build /src/apps/api/package.json ./apps/api/package.json
WORKDIR /srv/apps/api
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
