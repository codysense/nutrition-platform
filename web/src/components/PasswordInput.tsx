import { useState } from 'react';

/** Password field with a Show/Hide button. The button is keyboard-reachable and announces its state. */
export function PasswordInput({ id, value, onChange, autoComplete, required, minLength, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: 'current-password' | 'new-password';
  required?: boolean; minLength?: number; placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id} className="input pr-16" type={visible ? 'text' : 'password'} value={value} autoComplete={autoComplete}
        required={required} minLength={minLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button" onClick={() => setVisible((v) => !v)} aria-pressed={visible} aria-controls={id}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 rounded-r-md px-3 text-xs font-medium text-slate-600 hover:text-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
