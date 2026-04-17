import { type ReactNode } from 'react';

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]"
    >
      {children}
    </label>
  );
}