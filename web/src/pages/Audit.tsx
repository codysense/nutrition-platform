import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { fmtDate, ROLE_LABEL, titleCase } from '../lib/format';
import { AuditItem, Paged } from '../lib/types';
import { ErrorBox, PageHeader, Pager } from '../components/ui';

const ENTITIES = ['Recipe', 'Food', 'User', 'KnowledgeSource', 'ReviewComment'];
const ACTIONS = ['LOGIN', 'STATUS_CHANGE', 'BULK_STATUS_CHANGE', 'UPDATE', 'CREATE', 'COMMENT', 'COMMENT_RESOLVED', 'COMMENT_REOPENED', 'EXPORT', 'PASSWORD_CHANGED'];

function detail(a: AuditItem): string {
  const m = a.meta ?? {};
  if (a.action === 'STATUS_CHANGE') return `${titleCase(String(m.from))} → ${titleCase(String(m.to))}${m.note ? `: “${String(m.note)}”` : ''}`;
  if (a.action === 'BULK_STATUS_CHANGE') return `to ${titleCase(String(m.to))}: moved ${String(m.moved)} of ${String(m.requested)}, skipped ${String(m.skipped)}`;
  if (a.action === 'UPDATE' && Array.isArray(m.fields)) return `${(m.fields as string[]).join(', ')}${m.approvalInvalidated ? ' (approval withdrawn, back to review)' : ''}`;
  if (a.action === 'EXPORT') return `${String(m.format).toUpperCase()}, ${String(m.count)} item(s), status ${String(m.status)}`;
  if (a.action === 'COMMENT') return m.field ? `on ${String(m.field)}` : 'general';
  return Object.keys(m).length ? JSON.stringify(m) : '';
}

export default function Audit() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, isFetching } = useQuery({
    queryKey: ['audit', entityType, action, page],
    queryFn: () => api<Paged<AuditItem>>('/admin/audit' + qs({ entityType, action, page, pageSize: 50 })),
    placeholderData: keepPreviousData,
  });

  const target = (a: AuditItem) => {
    const label = a.entityName ?? a.entityType;
    if (a.entityId && a.entityType === 'Recipe') return <Link className="text-brand-700 hover:underline" to={`/dishes/${a.entityId}`}>{label}</Link>;
    if (a.entityId && a.entityType === 'Food') return <Link className="text-brand-700 hover:underline" to={`/foods/${a.entityId}`}>{label}</Link>;
    return <span>{label}</span>;
  };

  return (
    <>
      <PageHeader title="Audit log" subtitle="Who changed what, and when. Visible to super admins only." />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2">
        <select className="input" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
          <option value="">All record types</option>{ENTITIES.map((e) => <option key={e}>{e}</option>)}
        </select>
        <select className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
        </select>
      </div>
      {error && <ErrorBox error={error} />}
      <div className={`card overflow-hidden ${isFetching ? 'opacity-70' : ''}`}>
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Record</th><th className="th">Details</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((a) => (
              <tr key={a.id} className="align-top">
                <td className="td whitespace-nowrap text-xs text-slate-500">{fmtDate(a.createdAt)}</td>
                <td className="td">{a.actor ? <>{a.actor.name} <span className="text-xs text-slate-400">{ROLE_LABEL[a.actor.role]}</span></> : <span className="text-slate-400">System</span>}</td>
                <td className="td"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{titleCase(a.action)}</span></td>
                <td className="td">{target(a)}</td>
                <td className="td text-slate-600">{detail(a)}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={5}>No events match.</td></tr>}
          </tbody>
        </table>
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </div>
    </>
  );
}
