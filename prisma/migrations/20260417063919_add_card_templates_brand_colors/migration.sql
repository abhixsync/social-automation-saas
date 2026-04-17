-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ImageStyle" ADD VALUE 'minimal_light';
ALTER TYPE "ImageStyle" ADD VALUE 'minimal_dark';
ALTER TYPE "ImageStyle" ADD VALUE 'list_card';

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "showProfilePicOnCard" BOOLEAN NOT NULL DEFAULT false;
