import { shortName } from './normalize';
import { DishMatch } from './match';

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
const plain = (name: string) => shortName(name).toLowerCase();

/** Plain-language reasons for a result. English only for now; the UI can translate these later. */
export function explainMatch(m: DishMatch): string[] {
  const out: string[] = [];
  const names = m.usedFoods.map((f) => plain(f.name));
  if (names.length) out.push(`Uses your ${names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : list(names)}.`);

  if (m.status === 'READY') out.push('You have all the main ingredients.');
  else {
    const missing = m.missingCore.flatMap((i) => (i.missing.length ? i.missing.map((x) => plain(x.name)) : [i.text]));
    out.push(`You have ${m.coreHave} of ${m.coreTotal} main ingredients. Missing: ${list([...new Set(missing)])}.`);
  }
  for (const item of m.missingCore) {
    const swap = item.swaps[0];
    if (swap) out.push(`You could use ${plain(swap.name)} instead of ${plain(item.missing[0].name)} (${swap.reason}).`);
  }
  if (m.missingSeasoning.length) out.push(`Better with: ${list(m.missingSeasoning.flatMap((i) => i.missing.map((x) => plain(x.name))).slice(0, 4))}.`);
  if (m.assumedStaples.length) out.push('Assumes you have water, salt and cooking oil where needed.');
  for (const w of m.warnings) out.push(w.message);
  return out;
}
