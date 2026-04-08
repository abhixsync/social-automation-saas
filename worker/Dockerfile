FROM node:20-alpine

WORKDIR /app

# Copy prisma schema + main src (worker imports from here)
COPY prisma/ ./prisma/
COPY src/ ./src/

# Install worker dependencies
COPY worker/package.json ./worker/package.json
WORKDIR /app/worker
RUN npm install

# Generate Prisma client into ../src/generated/prisma/
RUN npx prisma generate --schema=../prisma/schema.prisma

# Copy worker source
COPY worker/src/ ./src/

ENV NODE_ENV=production

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
