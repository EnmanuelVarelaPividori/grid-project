# syntax=docker/dockerfile:1
# Official Node LTS image, pinned to its verified multi-platform digest.
FROM mirror.gcr.io/library/node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS base
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json ./apps/landing/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY . .
RUN pnpm run build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json ./apps/landing/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM mirror.gcr.io/library/node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS runtime
WORKDIR /app
ARG VCS_REF=development
ARG APP_NAME=landing
LABEL org.opencontainers.image.source="https://github.com/EnmanuelVarelaPividori/grid-project" \
      org.opencontainers.image.revision="${VCS_REF}" \
      dev.evarela.app="grid-project"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 BUILD_REVISION=${VCS_REF} APP_NAME=${APP_NAME}
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/apps ./apps
COPY --from=build --chown=node:node /app/apps/${APP_NAME}/dist ./apps/${APP_NAME}/dist
COPY --chown=node:node package.json ./
COPY --chown=node:node server/http.mjs server/start.mjs ./server/
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/start.mjs"]
