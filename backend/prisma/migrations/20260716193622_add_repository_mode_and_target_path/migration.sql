-- CreateEnum
CREATE TYPE "RepositoryMode" AS ENUM ('STANDALONE', 'EMBEDDED');

-- DropIndex
DROP INDEX "repositories_design_system_id_key";

-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "mode" "RepositoryMode" NOT NULL DEFAULT 'STANDALONE',
ADD COLUMN     "target_path" TEXT;
