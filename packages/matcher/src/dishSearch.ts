import { normalize, tokens, withinEdits } from './normalize';
import { CatalogDish, Catalogue } from './types';

/** Search dishes by name or local name ("amala", "ofe oha", "moin moin"). */
export function searchDishes(catalogue: Catalogue, query: string, limit = 10): CatalogDish[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const qToks = tokens(query);
  const scored: { dish: CatalogDish; score: number }[] = [];
  for (const dish of catalogue.dishes) {
    let best = 0;
    for (const name of [dish.name, ...dish.aliases.map((a) => a.name)]) {
      const n = normalize(name);
      const nToks = tokens(name);
      let s = 0;
      if (n === q) s = 100;
      else if (n.startsWith(q)) s = 85;
      else if (qToks.every((t) => nToks.includes(t))) s = 75;
      else if (qToks.every((t) => nToks.some((nt) => nt.startsWith(t)))) s = 70;
      else if (q.length >= 3 && n.includes(q)) s = 50;
      else if (q.length >= 5 && nToks.some((nt) => nt.length >= 5 && withinEdits(q, nt, 1))) s = 35;
      best = Math.max(best, s);
    }
    if (best) scored.push({ dish, score: best });
  }
  return scored.sort((a, b) => b.score - a.score || a.dish.name.localeCompare(b.dish.name)).slice(0, limit).map((s) => s.dish);
}
