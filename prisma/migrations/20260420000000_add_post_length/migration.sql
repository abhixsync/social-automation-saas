-- CreateEnum
CREATE TYPE "PostLength" AS ENUM ('short', 'medium', 'long');

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN "postLength" "PostLength" NOT NULL DEFAULT 'medium';
