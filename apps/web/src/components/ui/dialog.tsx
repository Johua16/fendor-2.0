'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './button';

/** Native modal dialog supplies focus containment, Escape, and inert background. */
export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className="ui-dialog" aria-labelledby={titleId} onCancel={onClose} onClose={onClose}>
    <div className="ui-dialog__heading"><h2 id={titleId}>{title}</h2><Button variant="quiet" onClick={onClose} aria-label="Close dialog">Close ×</Button></div>
    {children}
  </dialog>;
}
