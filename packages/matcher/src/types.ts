/** How much an ingredient line matters when matching a dish. Mirrors the back office's IngredientRole. */
export type Role = 'CORE' | 'SEASONING' | 'STAPLE' | 'OPTIONAL';

export interface Alias {
  language: string; // 'yoruba' | 'hausa' | 'igbo' | 'english' | ...
  name: string;
}

export interface CatalogFood {
  id: string;
  name: string; // English / default name, e.g. "Ugu (fluted pumpkin leaves)"
  category: string; // e.g. "Leafy vegetables"
  aliases: Alias[];
  /** Assumed to be in every kitchen (salt, cooking oil, seasoning cubes). Set when the catalogue is built. */
  staple?: boolean;
}

export interface CatalogLine {
  position: number;
  text: string; // the ingredient line as written, e.g. "4 tatashe, 2 scotch bonnet, 2 onions (blended)"
  role: Role;
  foodIds: string[];
  /** True when the line lists alternatives ("beef or chicken"): having any one of the foods is enough. */
  anyOf: boolean;
}

export type CostTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type SpiceLevel = 'MILD' | 'MEDIUM' | 'HOT';
export type AnimalFlesh = 'YES' | 'NO' | 'OPTIONAL';

/** The small, search-friendly view of a published dish. Steps and long text are fetched per dish, not shipped here. */
export interface CatalogDish {
  id: string;
  slug: string;
  name: string;
  category: string;
  cuisine: string | null;
  mealSlot: string | null;
  costTier: CostTier | null;
  spiceLevel: SpiceLevel | null;
  totalMinutes: number | null;
  allergenFlags: string[];
  containsAnimalFlesh: AnimalFlesh | null;
  aliases: Alias[];
  lines: CatalogLine[];
}

export interface Catalogue {
  version: string;
  foods: CatalogFood[];
  dishes: CatalogDish[];
}
