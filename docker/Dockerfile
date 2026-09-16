FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/editor/package.json apps/editor/package.json
COPY apps/viewer/package.json apps/viewer/package.json
COPY packages/map-model/package.json packages/map-model/package.json
COPY packages/map-engine/package.json packages/map-engine/package.json
COPY packages/map-sdk/package.json packages/map-sdk/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/editor/package.json apps/editor/package.json
COPY --from=build /app/apps/viewer/package.json apps/viewer/package.json
COPY --from=build /app/packages packages
RUN npm ci --omit=dev --workspace @alarmap/api --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/migrations apps/api/migrations
RUN mkdir -p /app/secrets && chown node:node /app/secrets
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

FROM nginx:stable-alpine AS editor
COPY docker/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/editor/browser /usr/share/nginx/html
EXPOSE 80

FROM nginx:stable-alpine AS viewer
COPY docker/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/viewer/browser /usr/share/nginx/html
EXPOSE 80
