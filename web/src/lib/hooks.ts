import { useQueryClient } from '@tanstack/react-query';
import { Kind } from './types';

export const basePath = (kind: Kind) => (kind === 'dish' ? '/admin/dishes' : '/admin/foods');

/** After any mutation, refresh everything that could show the changed data. */
export function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all(['dish', 'food', 'dishes', 'foods', 'queue', 'stats'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
