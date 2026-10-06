FROM node:22-bookworm-slim AS build
RUN npm install -g pnpm@12.8.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec tsup server.ts --format esm --platform node --out-dir dist-api --external sharp
RUN pnpm prune --prod
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build --chown=node:node /app /app
ENV NODE_ENV=production CSP_HOST=0.0.0.0
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+ (process.env.CSP_PORT || '3001') +'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-api/server.js"]
