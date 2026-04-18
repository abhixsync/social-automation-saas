// Shim for @prisma/client — prevents Jest from loading the WASM runtime.
// Individual tests mock '../src/lib/prisma' or '../worker/src/lib/prisma'
// directly, so this shim only needs to satisfy import-time requirements.

export const PrismaClient = jest.fn().mockImplementation(() => ({
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
  user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
  post: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  linkedInAccount: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  userPreferences: { findUnique: jest.fn(), upsert: jest.fn() },
  webhookEvent: { findUnique: jest.fn(), create: jest.fn() },
  siteSetting: { findMany: jest.fn() },
  notification: { create: jest.fn() },
  creditTopup: { create: jest.fn() },
}))

// Enums used by application code
export const Plan = { free: 'free', pro: 'pro' }
export const PostStatus = {
  draft: 'draft',
  pending_approval: 'pending_approval',
  approved: 'approved',
  published: 'published',
  failed: 'failed',
  skipped: 'skipped',
}
export const AIModel = {
  llama_3_1_8b: 'llama_3_1_8b',
  llama_3_3_70b: 'llama_3_3_70b',
  claude_sonnet: 'claude_sonnet',
}
export const ImageStyle = {
  quote_card: 'quote_card',
  stats_card: 'stats_card',
  topic_card: 'topic_card',
  minimal_light: 'minimal_light',
  minimal_dark: 'minimal_dark',
  list_card: 'list_card',
  stock_photo: 'stock_photo',
  ai_generated: 'ai_generated',
}
export const Tone = {
  professional: 'professional',
  casual: 'casual',
  thought_leader: 'thought_leader',
  storyteller: 'storyteller',
}
export const Currency = { INR: 'INR', USD: 'USD' }
