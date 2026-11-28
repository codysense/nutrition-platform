export interface LineState {
  position: number;
  role: string;
  roleConfirmed: boolean;
  mappingStatus: string;
  foods: { id: string }[];
}

/** A line is "ready" when a person has confirmed both what it is (links) and how much it matters (role). */
export const isLineReady = (l: Pick<LineState, 'mappingStatus' | 'roleConfirmed'>) => l.mappingStatus === 'CONFIRMED' && l.roleConfirmed;

/** Core and seasoning lines must point at a foodstuff to be matchable; staples and optional lines need none (water, foil). */
export const needsFoodstuff = (role: string) => role === 'CORE' || role === 'SEASONING';

export function readinessReport(lines: LineState[]) {
  const notReady = lines.filter((l) => !isLineReady(l));
  return { total: lines.length, ready: lines.length - notReady.length, notReady: notReady.map((l) => l.position) };
}

/** Lines that "Confirm all" may confirm: they are checkable at a glance and have what they need to be matchable. */
export function confirmableLines<T extends LineState>(lines: T[]): T[] {
  return lines.filter((l) => !isLineReady(l) && (!needsFoodstuff(l.role) || l.foods.length > 0));
}
