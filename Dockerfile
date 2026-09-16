FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY frontend ./frontend
COPY shared ./shared
COPY backend ./backend
COPY database ./database
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=4317 HOST=0.0.0.0 \
    QUERYROOM_ENGINE_MODE=external
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/frontend/.next ./frontend/.next
COPY --chown=node:node frontend/public ./frontend/public
COPY --chown=node:node frontend/next.config.ts ./frontend/next.config.ts
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node backend ./backend
COPY --chown=node:node database ./database
COPY --chown=node:node shared ./shared
COPY --chown=node:node scripts ./scripts
# Server configuration is copied only into the runtime stage, after the frontend build.
COPY --chown=node:node --chmod=0400 .env ./.env
USER node
EXPOSE 4317
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "backend/index.ts"]
