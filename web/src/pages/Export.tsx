import { useState } from 'react';
import { Link } from 'react-router-dom';
import { download, qs } from '../lib/api';
import { STATUSES, STATUS_LABEL } from '../lib/format';
import { ErrorBox, PageHeader } from '../components/ui';

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="input w-auto" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All statuses</option>
      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
  );
}

export default function Export() {
  const [dishStatus, setDishStatus] = useState('PENDING_REVIEW');
  const [foodStatus, setFoodStatus] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState('');

  const run = async (key: string, path: string, name: string) => {
    setError(null);
    setBusy(key);
    try {
      await download(path, name);
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <PageHeader title="Export for offline review" subtitle="For reviewers who prefer a document or spreadsheet. Exports are recorded in the audit log." />
      {error != null && <div className="mb-4"><ErrorBox error={error} /></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Dishes</h2>
          <p className="mb-4 text-sm text-slate-500">Claims, allergens, ingredients, local names and open comments for each dish.</p>
          <div className="mb-4"><StatusSelect value={dishStatus} onChange={setDishStatus} /></div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn-primary" to={`/export/sheet${qs({ status: dishStatus })}`}>Open printable review sheet</Link>
            <button className="btn-secondary" disabled={busy === 'dishes'} onClick={() => run('dishes', '/admin/export/dishes.csv' + qs({ status: dishStatus }), 'dishes.csv')}>Download CSV</button>
          </div>
          <p className="mt-3 text-xs text-slate-500">The review sheet opens in your browser: use Print and choose “Save as PDF”.</p>
        </section>
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Foodstuffs</h2>
          <p className="mb-4 text-sm text-slate-500">Ingredient list with local names and any nutrient values entered so far.</p>
          <div className="mb-4"><StatusSelect value={foodStatus} onChange={setFoodStatus} /></div>
          <button className="btn-secondary" disabled={busy === 'foods'} onClick={() => run('foods', '/admin/export/foods.csv' + qs({ status: foodStatus }), 'foodstuffs.csv')}>Download CSV</button>
        </section>
      </div>
    </>
  );
}
