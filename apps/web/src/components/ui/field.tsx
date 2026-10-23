import type { InputHTMLAttributes } from 'react';

export function Field({ label, id, hint, error, hideLabel = false, ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string; error?: string; hideLabel?: boolean }) {
  const description = [props['aria-describedby'], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className="ui-field">
    <label className={hideLabel ? 'visually-hidden' : undefined} htmlFor={id}>{label}</label>
    <input {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={description} />
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {error && <small className="ui-field__error" id={`${id}-error`} role="alert">{error}</small>}
  </div>;
}
