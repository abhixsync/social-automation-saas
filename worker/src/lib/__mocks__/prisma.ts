// Automatic Jest mock for worker/src/lib/prisma.
// Jest uses this file when jest.mock('...worker/src/lib/prisma') is called.
// All methods are jest.fn() so tests can override return values per-test.

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
