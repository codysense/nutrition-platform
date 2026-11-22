import { useState } from 'react';

/** Row selection that survives paging, plus a "select everything matching the filter" mode. */
export function useSelection(pageIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);

  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggle = (id: string) => {
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };
  const togglePage = () => {
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const clear = () => {
    setSelected(new Set());
    setAllMatching(false);
  };
  return { selected, allMatching, setAllMatching, toggle, togglePage, allOnPage, clear };
}
