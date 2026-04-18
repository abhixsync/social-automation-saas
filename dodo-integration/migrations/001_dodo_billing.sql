-- ── Dodo Payments billing columns on users table ──────────────────────────────
-- Add these to your existing users table.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dodo_customer_id      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS dodo_subscription_id  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS plan                  TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS credits_used          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_reset_at      TIMESTAMPTZ DEFAULT NOW();

-- ── Webhook idempotency ────────────────────────────────────────────────────────
-- Stores processed webhook-id values so Dodo retries don't double-process events.

CREATE TABLE IF NOT EXISTS dodo_webhook_events (
  event_id   TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-prune: delete events older than 30 days (past Dodo's retry window).
-- Run this periodically (cron job or scheduled query).
-- DELETE FROM dodo_webhook_events WHERE created_at < NOW() - INTERVAL '30 days';

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_dodo_subscription ON users (dodo_subscription_id)
  WHERE dodo_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dodo_webhook_events_created ON dodo_webhook_events (created_at);
