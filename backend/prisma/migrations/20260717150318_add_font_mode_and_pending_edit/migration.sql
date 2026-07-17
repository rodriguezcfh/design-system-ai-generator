-- CreateEnum
CREATE TYPE "BrandFontMode" AS ENUM ('UNSET', 'SINGLE', 'SEPARATE');

-- AlterTable
ALTER TABLE "brand_briefs" ADD COLUMN     "preferred_font_mode" "BrandFontMode" NOT NULL DEFAULT 'UNSET';

-- AlterTable
ALTER TABLE "design_systems" ADD COLUMN     "pending_edit_patch" JSONB,
ADD COLUMN     "pending_edit_summary" TEXT;
