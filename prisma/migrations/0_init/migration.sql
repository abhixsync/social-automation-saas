-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'pro');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('INR', 'USD');

-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('professional', 'casual', 'thought_leader', 'storyteller');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'published', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "AIModel" AS ENUM ('llama_3_1_8b', 'llama_3_3_70b', 'claude_sonnet');

-- CreateEnum
CREATE TYPE "ImageStyle" AS ENUM ('quote_card', 'stats_card', 'topic_card');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "currency" "Currency" NOT NULL DEFAULT 'INR',
    "razorpayCustomerId" TEXT,
    "razorpaySubscriptionId" TEXT,
    "lifetimeFree" BOOLEAN NOT NULL DEFAULT false,
    "aiCreditsTotal" INTEGER NOT NULL DEFAULT 1000,
    "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT,
    "profilePicture" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedInAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "niche" TEXT NOT NULL DEFAULT 'tech professional',
    "tone" "Tone" NOT NULL DEFAULT 'professional',
    "contentPillars" TEXT[],
    "customPromptSuffix" TEXT,
    "approvalMode" BOOLEAN NOT NULL DEFAULT false,
    "imageStyle" "ImageStyle" NOT NULL DEFAULT 'quote_card',
    "autoImage" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedInAccountId" TEXT NOT NULL,
    "cronExpression" TEXT,
    "times" TEXT[],
    "daysOfWeek" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedInAccountId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "generatedContent" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "aiModel" "AIModel" NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "includeImage" BOOLEAN NOT NULL DEFAULT true,
    "imageStyle" "ImageStyle",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTopup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpayOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTopup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_razorpayCustomerId_key" ON "User"("razorpayCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_razorpaySubscriptionId_key" ON "User"("razorpaySubscriptionId");

-- CreateIndex
CREATE INDEX "User_razorpayCustomerId_idx" ON "User"("razorpayCustomerId");

-- CreateIndex
CREATE INDEX "User_plan_idx" ON "User"("plan");

-- CreateIndex
CREATE INDEX "LinkedInAccount_userId_idx" ON "LinkedInAccount"("userId");

-- CreateIndex
CREATE INDEX "LinkedInAccount_expiresAt_idx" ON "LinkedInAccount"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInAccount_userId_sub_key" ON "LinkedInAccount"("userId", "sub");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "PostSchedule_userId_idx" ON "PostSchedule"("userId");

-- CreateIndex
CREATE INDEX "PostSchedule_isActive_idx" ON "PostSchedule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PostSchedule_userId_linkedInAccountId_key" ON "PostSchedule"("userId", "linkedInAccountId");

-- CreateIndex
CREATE INDEX "Post_userId_status_idx" ON "Post"("userId", "status");

-- CreateIndex
CREATE INDEX "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_linkedInAccountId_idx" ON "Post"("linkedInAccountId");

-- CreateIndex
CREATE INDEX "Post_scheduledFor_idx" ON "Post"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTopup_razorpayPaymentId_key" ON "CreditTopup"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTopup_razorpayOrderId_key" ON "CreditTopup"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "CreditTopup_userId_idx" ON "CreditTopup"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInAccount" ADD CONSTRAINT "LinkedInAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSchedule" ADD CONSTRAINT "PostSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSchedule" ADD CONSTRAINT "PostSchedule_linkedInAccountId_fkey" FOREIGN KEY ("linkedInAccountId") REFERENCES "LinkedInAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_linkedInAccountId_fkey" FOREIGN KEY ("linkedInAccountId") REFERENCES "LinkedInAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTopup" ADD CONSTRAINT "CreditTopup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

