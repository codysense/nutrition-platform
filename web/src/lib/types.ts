export type Role = 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'NUTRITION_REVIEWER' | 'VIEWER';
export type ReviewStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED' | 'REQUIRES_UPDATE';
export type Kind = 'dish' | 'food';

export interface User { id: string; email: string; name: string; role: Role; mustChangePassword: boolean }

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }

export interface Comment {
  id: string; field: string | null; body: string; resolved: boolean; createdAt: string;
  author: { id: string; name: string; role: Role };
}

export interface AllowedTransition { to: ReviewStatus; noteRequired: boolean; blockedReason?: string }

export interface Alias { id?: string; language: string; name: string; verified: boolean }

export interface FoodRef { id: string; code: string; name: string; status?: ReviewStatus }

export type IngredientRole = 'CORE' | 'SEASONING' | 'STAPLE' | 'OPTIONAL';

export interface IngredientLine {
  id: string; position: number; rawText: string; optional: boolean;
  mappingStatus: 'UNMAPPED' | 'AUTO_SUGGESTED' | 'CONFIRMED'; role: IngredientRole; roleConfirmed: boolean; foods: FoodRef[];
}

export interface DishListItem {
  id: string; legacyNo: number | null; slug: string; name: string; category: string; cuisine: string | null;
  region: string | null; status: ReviewStatus; namesVerified: boolean; allergenFlags: string[]; updatedAt: string;
  _count: { comments: number; lines: number }; liveSnapshot?: { version: number } | null;
}

export interface Dish {
  id: string; legacyNo: number | null; slug: string; name: string; category: string; originNote: string | null;
  cuisine: string | null; region: string | null; mealSlot: string | null; cookingMethod: string | null;
  spiceLevel: string | null; costTier: string | null; summaryIngredients: string | null; timeText: string | null;
  totalMinutes: number | null; difficulty: string | null; servings: number | null; healthBenefits: string | null;
  keyNutrients: string | null; cautions: string | null; frequencyGuide: string | null; allergenFlags: string[];
  containsAnimalFlesh: string | null; servedWith: string | null; occasion: string | null; storageGuidance: string | null;
  tips: string | null; evidenceLevel: string; status: ReviewStatus; namesVerified: boolean; lastEditedById: string | null;
  updatedAt: string; aliases: Alias[]; lines: IngredientLine[]; steps: { id: string; stepNumber: number; instruction: string }[];
  comments: Comment[]; allowedTransitions: AllowedTransition[];
  live?: { version: number; publishedAt: string; approvedAt: string | null; hasUnpublishedChanges: boolean } | null;
  versions?: { version: number; publishedAt: string; retiredAt: string | null; approvedAt: string | null }[];
}

export interface FoodListItem {
  id: string; code: string; name: string; category: string; status: ReviewStatus; namesVerified: boolean; updatedAt: string;
  aliases: { language: string; name: string }[];
  _count: { nutrients: number; lines: number; comments: number };
}

export interface Nutrient { id: string; key: string; name: string; unit: string; sortOrder: number }
export interface Source { id: string; title: string; publisher: string | null; publicationYear: number | null }

export interface FoodNutrientValue {
  id: string; amount: string; basisGrams: string; citation: string | null; quality: string; nutrientId: string;
  nutrient: Nutrient; source: { id: string; title: string; publicationYear: number | null };
}

export interface Food {
  id: string; code: string; name: string; category: string; forms: string | null; botanicalName: string | null;
  allergenNote: string | null; referenceForm: string | null; status: ReviewStatus; namesVerified: boolean;
  lastEditedById: string | null; updatedAt: string; aliases: Alias[]; nutrients: FoodNutrientValue[];
  comments: Comment[]; usedIn: { id: string; name: string; legacyNo: number | null }[]; allowedTransitions: AllowedTransition[];
}

export interface Stats {
  recipesByStatus: Record<string, number>; foodsByStatus: Record<string, number>;
  foods: { total: number; withNutrientValues: number };
  nutrientCoverage: { key: string; name: string; foodsWithValue: number; totalFoods: number }[];
  openComments: number; unmappedIngredientLines: number; recipesWithUnverifiedNames: number;
  liveDishes?: number; ingredientLines?: { total: number; ready: number };
}

export interface Queue {
  recipes: { id: string; legacyNo: number | null; name: string; category: string; updatedAt: string; lastEditedById: string | null; _count: { comments: number } }[];
  foods: { id: string; code: string; name: string; category: string; updatedAt: string; lastEditedById: string | null; _count: { comments: number } }[];
}

export interface BulkResult { total: number; moved: number; skipped: { id: string; name: string; reason: string }[] }

export interface UserRow { id: string; email: string; name: string; role: Role; isActive: boolean; mustChangePassword: boolean; createdAt: string }

export interface AuditItem {
  id: string; action: string; entityType: string; entityId: string | null; entityName: string | null;
  meta: Record<string, unknown> | null; createdAt: string; actor: { id: string; name: string; role: Role } | null;
}

export interface ExportDish {
  id: string; legacyNo: number | null; name: string; category: string; cuisine: string | null; region: string | null; status: ReviewStatus;
  healthBenefits: string | null; keyNutrients: string | null; cautions: string | null; frequencyGuide: string | null;
  allergenFlags: string[]; containsAnimalFlesh: string | null; storageGuidance: string | null; ingredients: string[];
  aliases: { language: string; name: string; verified: boolean }[]; namesVerified: boolean;
  openComments: { field: string | null; body: string; author: string }[];
}
