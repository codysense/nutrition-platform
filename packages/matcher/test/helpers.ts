import { CatalogDish, CatalogFood, CatalogLine, Catalogue, Role } from '../src';

export const food = (id: string, name: string, category: string, aliases: CatalogFood['aliases'] = [], staple = false): CatalogFood => ({ id, name, category, aliases, staple });

export const line = (position: number, text: string, role: Role, foodIds: string[], anyOf = false): CatalogLine => ({ position, text, role, foodIds, anyOf });

export const dish = (id: string, name: string, lines: CatalogLine[], over: Partial<CatalogDish> = {}): CatalogDish => ({
  id, slug: id, name, category: 'Main dish', cuisine: 'Pan-Nigerian', mealSlot: 'Any meal', costTier: 'LOW', spiceLevel: 'MILD', totalMinutes: 30,
  allergenFlags: [], containsAnimalFlesh: 'NO', aliases: [], lines, ...over,
});

/** A small hand-built catalogue so each rule can be tested in isolation. */
export function mini(): Catalogue {
  const foods = [
    food('rice', 'Rice', 'Grains & cereals'), food('tomato', 'Tomato', 'Other vegetables'), food('onion', 'Onion', 'Other vegetables'),
    food('beef', 'Beef', 'Meat & poultry'), food('chicken', 'Chicken', 'Meat & poultry'), food('ugu', 'Ugu (fluted pumpkin leaves)', 'Leafy vegetables'),
    food('spinach', 'Spinach', 'Leafy vegetables'), food('salt', 'Salt', 'Herbs, spices & seasonings', [], true), food('curry', 'Curry powder', 'Herbs, spices & seasonings'),
    food('groundnut', 'Groundnut (peanut)', 'Legumes & beans'), food('egg', 'Egg', 'Dairy & eggs'), food('fish', 'Smoked fish', 'Fish & seafood'),
  ];
  const dishes = [
    dish('plain-rice', 'Plain rice', [line(1, '3 cups rice', 'CORE', ['rice']), line(2, 'Salt to taste', 'STAPLE', ['salt']), line(3, 'Clean water', 'STAPLE', [])]),
    dish('beef-stew', 'Beef stew', [
      line(1, '500g beef', 'CORE', ['beef']), line(2, '4 tomatoes', 'CORE', ['tomato']), line(3, '2 onions', 'CORE', ['onion']),
      line(4, '1 tsp curry', 'SEASONING', ['curry']), line(5, 'Oil for frying', 'STAPLE', []), line(6, 'Fresh parsley (optional)', 'OPTIONAL', []),
    ], { containsAnimalFlesh: 'YES', costTier: 'HIGH', totalMinutes: 90 }),
    dish('chicken-or-beef-rice', 'Chicken or beef rice', [line(1, '3 cups rice', 'CORE', ['rice']), line(2, '500g chicken or beef', 'CORE', ['chicken', 'beef'], true)], { containsAnimalFlesh: 'YES', cuisine: 'Yoruba' }),
    dish('greens-stew', 'Greens stew', [line(1, '2 cups ugu', 'CORE', ['ugu']), line(2, '1 onion', 'CORE', ['onion'])], { cuisine: 'Igbo' }),
    dish('pepper-onion-sauce', 'Tomato and onion sauce', [line(1, 'Tomatoes, onions', 'CORE', ['tomato', 'onion'])]),
    dish('peanut-snack', 'Peanut snack', [line(1, '2 cups groundnuts', 'CORE', ['groundnut'])], { allergenFlags: ['Peanut'], totalMinutes: 20 }),
    dish('egg-dish', 'Egg dish', [line(1, '4 eggs', 'CORE', ['egg']), line(2, 'Smoked fish (optional)', 'OPTIONAL', ['fish'])], { allergenFlags: ['Fish (optional)'], containsAnimalFlesh: 'OPTIONAL', mealSlot: 'Breakfast' }),
    dish('mystery-dish', 'Mystery dish', [line(1, '1 onion', 'CORE', ['onion'])], { containsAnimalFlesh: null, totalMinutes: null, costTier: null }),
  ];
  return { version: 'mini', foods, dishes };
}
