-- AlterTable
ALTER TABLE "brand_briefs" ADD COLUMN     "preferred_body_font" TEXT,
ADD COLUMN     "preferred_colors" JSONB,
ADD COLUMN     "preferred_heading_font" TEXT;

-- AlterTable
ALTER TABLE "design_tokens" ADD COLUMN     "color_scales" JSONB,
ADD COLUMN     "typography_scale" JSONB;
