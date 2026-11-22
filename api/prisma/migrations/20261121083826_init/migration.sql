-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'CONTENT_MANAGER', 'NUTRITION_REVIEWER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED', 'REQUIRES_UPDATE');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('A_SCIENTIFIC', 'B_RESEARCH', 'C_COMMUNITY', 'D_PROFESSIONAL_REVIEW');

-- CreateEnum
CREATE TYPE "DataQuality" AS ENUM ('ANALYTICAL', 'CALCULATED', 'IMPUTED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "SpiceLevel" AS ENUM ('MILD', 'MEDIUM', 'HOT');

-- CreateEnum
CREATE TYPE "CostTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FrequencyGuide" AS ENUM ('REGULAR', 'MODERATE', 'OCCASIONAL', 'TREAT');

-- CreateEnum
CREATE TYPE "AnimalFlesh" AS ENUM ('YES', 'NO', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "MappingStatus" AS ENUM ('UNMAPPED', 'AUTO_SUGGESTED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "url" TEXT,
    "publicationYear" INTEGER,
    "licenseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "forms" TEXT,
    "botanicalName" TEXT,
    "allergenNote" TEXT,
    "referenceForm" TEXT,
    "searchKey1" TEXT,
    "searchKey2" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "namesVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastEditedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodAlias" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FoodAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nutrient" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Nutrient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodNutrient" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "nutrientId" TEXT NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "basisGrams" DECIMAL(8,2) NOT NULL DEFAULT 100,
    "sourceId" TEXT NOT NULL,
    "citation" TEXT,
    "quality" "DataQuality" NOT NULL,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodNutrient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "legacyNo" INTEGER,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originNote" TEXT,
    "cuisine" TEXT,
    "region" TEXT,
    "mealSlot" TEXT,
    "cookingMethod" TEXT,
    "spiceLevel" "SpiceLevel",
    "costTier" "CostTier",
    "summaryIngredients" TEXT,
    "timeText" TEXT,
    "totalMinutes" INTEGER,
    "difficulty" "Difficulty",
    "servings" INTEGER,
    "healthBenefits" TEXT,
    "keyNutrients" TEXT,
    "cautions" TEXT,
    "frequencyGuide" "FrequencyGuide",
    "allergenFlags" TEXT[],
    "containsAnimalFlesh" "AnimalFlesh",
    "servedWith" TEXT,
    "occasion" TEXT,
    "storageGuidance" TEXT,
    "tips" TEXT,
    "evidenceLevel" "EvidenceLevel" NOT NULL DEFAULT 'C_COMMUNITY',
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "namesVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastEditedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeAlias" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RecipeAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredientLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "quantity" DECIMAL(10,3),
    "unit" TEXT,
    "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'UNMAPPED',

    CONSTRAINT "RecipeIngredientLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT,
    "foodId" TEXT,
    "field" TEXT,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FoodToRecipeIngredientLine" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Food_code_key" ON "Food"("code");

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");

-- CreateIndex
CREATE INDEX "Food_category_idx" ON "Food"("category");

-- CreateIndex
CREATE INDEX "Food_status_idx" ON "Food"("status");

-- CreateIndex
CREATE INDEX "FoodAlias_name_idx" ON "FoodAlias"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Nutrient_key_key" ON "Nutrient"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FoodNutrient_foodId_nutrientId_key" ON "FoodNutrient"("foodId", "nutrientId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_legacyNo_key" ON "Recipe"("legacyNo");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "Recipe_status_idx" ON "Recipe"("status");

-- CreateIndex
CREATE INDEX "Recipe_category_idx" ON "Recipe"("category");

-- CreateIndex
CREATE INDEX "Recipe_cuisine_idx" ON "Recipe"("cuisine");

-- CreateIndex
CREATE INDEX "Recipe_name_idx" ON "Recipe"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredientLine_recipeId_position_key" ON "RecipeIngredientLine"("recipeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStep_recipeId_stepNumber_key" ON "RecipeStep"("recipeId", "stepNumber");

-- CreateIndex
CREATE INDEX "ReviewComment_recipeId_idx" ON "ReviewComment"("recipeId");

-- CreateIndex
CREATE INDEX "ReviewComment_foodId_idx" ON "ReviewComment"("foodId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_FoodToRecipeIngredientLine_AB_unique" ON "_FoodToRecipeIngredientLine"("A", "B");

-- CreateIndex
CREATE INDEX "_FoodToRecipeIngredientLine_B_index" ON "_FoodToRecipeIngredientLine"("B");

-- AddForeignKey
ALTER TABLE "FoodAlias" ADD CONSTRAINT "FoodAlias_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodNutrient" ADD CONSTRAINT "FoodNutrient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodNutrient" ADD CONSTRAINT "FoodNutrient_nutrientId_fkey" FOREIGN KEY ("nutrientId") REFERENCES "Nutrient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodNutrient" ADD CONSTRAINT "FoodNutrient_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeAlias" ADD CONSTRAINT "RecipeAlias_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredientLine" ADD CONSTRAINT "RecipeIngredientLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FoodToRecipeIngredientLine" ADD CONSTRAINT "_FoodToRecipeIngredientLine_A_fkey" FOREIGN KEY ("A") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FoodToRecipeIngredientLine" ADD CONSTRAINT "_FoodToRecipeIngredientLine_B_fkey" FOREIGN KEY ("B") REFERENCES "RecipeIngredientLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
