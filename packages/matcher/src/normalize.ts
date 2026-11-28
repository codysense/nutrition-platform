/** Lower-case, strip accents and tone marks ("Ẹ̀fọ́" -> "efo"), so people can type names without special characters. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** A deliberately small singulariser: tomatoes -> tomato, onions -> onion, leaves -> leaf, cloves -> clove. Applied to both sides of every comparison. */
export function singular(t: string): string {
  if (t.length <= 3) return t;
  if (t === 'leaves') return 'leaf';
  if (t.endsWith('ies') && t.length > 4) return t.slice(0, -3) + 'y';
  if (t.endsWith('oes')) return t.slice(0, -2);
  if (t.endsWith('ss') || t.endsWith('us') || t.endsWith('is')) return t;
  if (t.endsWith('s')) return t.slice(0, -1);
  return t;
}

export function tokens(s: string): string[] {
  return fold(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(singular);
}

export const normalize = (s: string): string => tokens(s).join(' ');

/** Edit distance, stopping early once it exceeds `max`. Used only for typo tolerance on longer words. */
export function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** "Spinach / efo tete (African spinach)" -> "Spinach / efo tete". For showing names in lists. */
export const shortName = (name: string): string => name.replace(/\s*\([^)]*\)/g, '').trim() || name;
