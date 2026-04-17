-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "isCarousel" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "carouselMode" BOOLEAN NOT NULL DEFAULT false;
