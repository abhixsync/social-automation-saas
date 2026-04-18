// Mock for worker/src/lib/prisma — used via moduleNameMapper.
// Provides the same mockFindMany etc. hooks that individual tests override
// via jest.mock('../src/lib/prisma', ...) which is aliased to the same shape.
// Tests that need worker prisma behaviour mock 'worker/src/lib/prisma' directly.

export const prisma = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  post: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  linkedInAccount: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  userPreferences: { findUnique: jest.fn(), upsert: jest.fn() },
  webhookEvent: { findUnique: jest.fn(), create: jest.fn() },
  siteSetting: { findMany: jest.fn() },
  notification: { create: jest.fn() },
  creditTopup: { create: jest.fn() },
}
