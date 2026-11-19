FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY server ./server
COPY src ./src
# Usa somente ferramentas instaladas pelo lockfile; nenhum download por npx.
RUN ./node_modules/.bin/tsc --noEmit -p server && ./node_modules/.bin/esbuild server/index.ts --bundle --platform=node --format=esm --target=node24 --packages=external --sourcemap --outfile=out/server.mjs

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=2567
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/out ./out
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "require('net').connect(Number(process.env.PORT),'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "out/server.mjs"]
