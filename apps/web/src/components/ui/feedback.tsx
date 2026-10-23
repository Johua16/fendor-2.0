import type { ReactNode } from 'react';

export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'soft' }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
export function Feedback({ children, kind = 'info' }: { children: ReactNode; kind?: 'info' | 'error' | 'success' }) {
  return <p className={`ui-feedback ui-feedback--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>;
}
