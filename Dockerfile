FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
RUN npm ci --prefix apps/web

FROM dependencies AS build
COPY apps/web ./apps/web
COPY server ./server
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --prefix apps/web

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/apps/web ./apps/web
COPY --from=build --chown=node:node /app/server ./server
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--prefix", "apps/web"]
