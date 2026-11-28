/*
  Warnings:

  - A unique constraint covering the columns `[liveSnapshotId]` on the table `Recipe` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "IngredientRole" AS ENUM ('CORE', 'SEASONING', 'STAPLE', 'OPTIONAL');

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "liveSnapshotId" TEXT;

-- AlterTable
ALTER TABLE "RecipeIngredientLine" ADD COLUMN     "role" "IngredientRole" NOT NULL DEFAULT 'CORE',
ADD COLUMN     "roleConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PublishedRecipe" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "PublishedRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishedRecipe_recipeId_idx" ON "PublishedRecipe"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedRecipe_recipeId_version_key" ON "PublishedRecipe"("recipeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_liveSnapshotId_key" ON "Recipe"("liveSnapshotId");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_liveSnapshotId_fkey" FOREIGN KEY ("liveSnapshotId") REFERENCES "PublishedRecipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedRecipe" ADD CONSTRAINT "PublishedRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
