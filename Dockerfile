FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server/ server/
COPY --from=build /app/dist dist/
ENV NODE_ENV=production
# Lets the app rewrite a "localhost" PROPRESENTER_HOST to host.docker.internal,
# so the same .env works both locally and in a container. See server/ppHost.ts.
ENV RUNNING_IN_DOCKER=true
# Informational only — the actual port is driven by APP_PORT at runtime, and
# docker-compose handles the host:container port mapping.
EXPOSE 7777
CMD ["npx", "tsx", "server/index.ts"]
