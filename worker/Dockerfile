FROM node:20-alpine

WORKDIR /app

# Copy prisma schema + main src (worker imports from here)
COPY prisma/ ./prisma/
COPY src/ ./src/

# Install worker dependencies
COPY worker/package.json worker/tsconfig.json ./worker/
WORKDIR /app/worker
RUN npm install

# Generate Prisma client into ../src/generated/prisma/
RUN npx prisma generate --schema=../prisma/schema.prisma

# Make @prisma packages visible to the generated client (ESM resolution walks up dirs)
RUN mkdir -p /app/node_modules && cp -r /app/worker/node_modules/@prisma /app/node_modules/

# Copy worker source
COPY worker/src/ ./src/

ENV NODE_ENV=production

CMD ["node_modules/.bin/tsx", "src/index.ts"]
