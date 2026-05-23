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
EXPOSE 3000
CMD ["npx", "tsx", "server/index.ts"]
