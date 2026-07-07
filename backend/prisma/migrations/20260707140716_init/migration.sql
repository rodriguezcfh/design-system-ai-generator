-- CreateEnum
CREATE TYPE "DesignSystemStatus" AS ENUM ('DRAFT', 'GENERATED', 'APPROVED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('INITIAL', 'UPDATE');

-- CreateEnum
CREATE TYPE "PrStatus" AS ENUM ('OPEN', 'MERGED', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_systems" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DesignSystemStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "design_system_id" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_briefs" (
    "id" TEXT NOT NULL,
    "design_system_id" TEXT NOT NULL,
    "tone" TEXT,
    "values" JSONB NOT NULL DEFAULT '[]',
    "references" JSONB NOT NULL DEFAULT '[]',
    "raw_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_tokens" (
    "id" TEXT NOT NULL,
    "design_system_id" TEXT NOT NULL,
    "colors" JSONB NOT NULL DEFAULT '{}',
    "typography" JSONB NOT NULL DEFAULT '{}',
    "component_code" TEXT,
    "wcag_valid" BOOLEAN NOT NULL DEFAULT false,
    "wcag_report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "github_username" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'repo',
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "design_system_id" TEXT NOT NULL,
    "repo_full_name" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "design_system_id" TEXT NOT NULL,
    "type" "ExportType" NOT NULL,
    "branch_name" TEXT,
    "pr_number" INTEGER,
    "pr_url" TEXT,
    "pr_title" TEXT,
    "pr_body" TEXT,
    "status" "PrStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_design_system_id_key" ON "conversations"("design_system_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_briefs_design_system_id_key" ON "brand_briefs"("design_system_id");

-- CreateIndex
CREATE UNIQUE INDEX "design_tokens_design_system_id_key" ON "design_tokens"("design_system_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_connections_user_id_key" ON "github_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_design_system_id_key" ON "repositories"("design_system_id");

-- AddForeignKey
ALTER TABLE "design_systems" ADD CONSTRAINT "design_systems_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_design_system_id_fkey" FOREIGN KEY ("design_system_id") REFERENCES "design_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_briefs" ADD CONSTRAINT "brand_briefs_design_system_id_fkey" FOREIGN KEY ("design_system_id") REFERENCES "design_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_tokens" ADD CONSTRAINT "design_tokens_design_system_id_fkey" FOREIGN KEY ("design_system_id") REFERENCES "design_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_design_system_id_fkey" FOREIGN KEY ("design_system_id") REFERENCES "design_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_design_system_id_fkey" FOREIGN KEY ("design_system_id") REFERENCES "design_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
