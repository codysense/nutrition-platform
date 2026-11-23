import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode; // leave empty for an actions column
  cell: (row: T) => ReactNode;
  title?: boolean; // the cell shown as the card heading on phones (default: first column)
  hideOnMobile?: boolean;
  align?: 'right';
}

export interface Selection<T> {
  isSelected: (row: T) => boolean;
  toggle: (row: T) => void;
  allOnPage: boolean;
  togglePage: () => void;
  label: (row: T) => string;
}

/**
 * A table on tablets and desktops; a list of cards on phones. Cards show the title cell first, then
 * "label: value" pairs, so nothing needs sideways scrolling.
 */
export function DataTable<T>({ rows, columns, rowKey, selection, empty = 'Nothing to show.' }: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; selection?: Selection<T>; empty?: string;
}) {
  if (rows.length === 0) return <p className="p-4 text-sm text-slate-500">{empty}</p>;
  const titleCol = columns.find((c) => c.title) ?? columns[0];
  const rest = columns.filter((c) => c !== titleCol && !c.hideOnMobile);

  return (
    <>
      {/* md and up: table */}
      <table className="hidden w-full md:table">
        <thead className="bg-slate-50">
          <tr>
            {selection && (
              <th className="th w-8">
                <input type="checkbox" aria-label="Select all on this page" checked={selection.allOnPage} onChange={selection.togglePage} />
              </th>
            )}
            {columns.map((c) => <th key={c.key} className={`th ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="align-top hover:bg-slate-50">
              {selection && (
                <td className="td">
                  <input type="checkbox" aria-label={`Select ${selection.label(r)}`} checked={selection.isSelected(r)} onChange={() => selection.toggle(r)} />
                </td>
              )}
              {columns.map((c) => <td key={c.key} className={`td ${c.align === 'right' ? 'text-right' : ''}`}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {/* phones: cards */}
      <div className="md:hidden">
        {selection && (
          <label className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input type="checkbox" className="h-5 w-5" checked={selection.allOnPage} onChange={selection.togglePage} /> Select all on this page
          </label>
        )}
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={rowKey(r)} className="p-4">
              <div className="flex items-start gap-3">
                {selection && (
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" aria-label={`Select ${selection.label(r)}`} checked={selection.isSelected(r)} onChange={() => selection.toggle(r)} />
                )}
                <div className="min-w-0 flex-1 break-words font-medium">{titleCol.cell(r)}</div>
              </div>
              {rest.length > 0 && (
                <dl className={`mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm ${selection ? 'pl-8' : ''}`}>
                  {rest.map((c) =>
                    c.header ? (
                      <div key={c.key} className="min-w-0 break-words">
                        <dt className="text-xs uppercase tracking-wide text-slate-400">{c.header}</dt>
                        <dd>{c.cell(r)}</dd>
                      </div>
                    ) : (
                      <div key={c.key} className="col-span-2 min-w-0 break-words text-slate-500">{c.cell(r)}</div>
                    ),
                  )}
                </dl>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
