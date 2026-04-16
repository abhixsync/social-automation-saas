FROM node:20-alpine

WORKDIR /app

# Copy prisma schema + main src (worker imports from here)
COPY prisma/ ./prisma/
COPY src/ ./src/

# Install worker dependencies (including devDependencies — tsx is needed at runtime)
COPY worker/package.json worker/tsconfig.json ./worker/
WORKDIR /app/worker
RUN npm install

# Generate Prisma client into ../src/generated/prisma/
RUN npx prisma generate --schema=../prisma/schema.prisma

# Make @prisma packages visible to the generated client (ESM resolution walks up dirs)
RUN mkdir -p /app/node_modules && cp -r /app/worker/node_modules/@prisma /app/node_modules/

# Copy worker source (run via tsx — no tsc compilation needed)
COPY worker/src/ ./src/

ENV NODE_ENV=production

# Health check endpoint (default port 9000, override with WORKER_HEALTH_PORT)
EXPOSE 9000

# tsx (esbuild-based TypeScript executor) handles ESM, CJS, extensionless imports,
# and import.meta.url natively — eliminating all tsc+Node16 module resolution issues
# with Prisma 7's TypeScript-first generated client.
CMD ["node_modules/.bin/tsx", "src/index.ts"]
