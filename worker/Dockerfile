FROM node:20-alpine

WORKDIR /app

# Copy prisma schema + main src (worker imports from here)
COPY prisma/ ./prisma/
COPY src/ ./src/

# Install worker dependencies (including devDependencies for build)
COPY worker/package.json worker/tsconfig.json ./worker/
WORKDIR /app/worker
RUN npm install

# Generate Prisma client into ../src/generated/prisma/
RUN npx prisma generate --schema=../prisma/schema.prisma

# Make @prisma packages visible to the generated client (ESM resolution walks up dirs)
RUN mkdir -p /app/node_modules && cp -r /app/worker/node_modules/@prisma /app/node_modules/

# Copy worker source and compile to dist/
COPY worker/src/ ./src/
RUN npm run build

# tsc roots from monorepo root due to cross-dir imports, so compiled output lands at
# dist/worker/src/. Relative imports in compiled code expect ../../../src/generated/prisma/
# to resolve to dist/src/generated/ — copy the generated client there.
RUN mkdir -p dist/src && cp -r /app/src/generated dist/src/

ENV NODE_ENV=production

# Health check endpoint (default port 9000, override with WORKER_HEALTH_PORT)
EXPOSE 9000

CMD ["node", "dist/worker/src/index.js"]
