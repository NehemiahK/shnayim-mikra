import { Link } from 'wouter';
import type { ReactNode } from 'react';

interface AppBarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
}

export function AppBar({ title, subtitle, back, backLabel, actions }: AppBarProps): React.JSX.Element {
  return (
    <header className="safe-top mb-4 flex items-start gap-3">
      {back !== undefined && (
        <Link
          href={back}
          aria-label={backLabel ?? 'Back'}
          className="-ms-2 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 19l-7-7 7-7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="rtl:hidden"
            />
            <path
              d="M9 19l7-7-7-7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="hidden rtl:block"
            />
          </svg>
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold leading-tight">{title}</h1>
        {subtitle !== undefined && (
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">{subtitle}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

export function Page({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="mx-auto min-h-[100dvh] w-full max-w-2xl px-4 pb-10">{children}</div>;
}

export function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
    >
      {children}
    </Link>
  );
}

export function GearIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
