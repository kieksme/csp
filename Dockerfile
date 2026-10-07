FROM node:22-bookworm-slim AS build
RUN npm install -g pnpm@12.8.1
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile && pnpm -r --filter './packages/**' build
RUN pnpm --filter csp-customer-template exec node ../../packages/cli/dist/index.js build
RUN pnpm --filter csp-customer-template deploy --prod --legacy /runtime
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production CSP_HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /runtime /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+ (process.env.CSP_PORT || '3001') +'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-api/server.js"]
