import { useEffect, useState, type ReactNode } from 'react';
import type { TranslationKey } from '../i18n.js';

interface EnglishDisclosureProps {
  /** Initial state, driven by the corresponding setting. */
  defaultOpen: boolean;
  t: (key: TranslationKey) => string;
  children: ReactNode;
}

/**
 * The "English" toggle used under both Rashi and the Targum.
 *
 * Shared so the two behave identically — same control, same wording, same
 * indented rule when open — and so neither drifts from the other. It is a
 * sibling of the passage it belongs to, never nested inside a tap target,
 * because an interactive element cannot live inside a button.
 */
export function EnglishDisclosure({
  defaultOpen,
  t,
  children,
}: EnglishDisclosureProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  // Follow the setting when it changes, without discarding a manual toggle.
  useEffect(() => { setOpen(defaultOpen); }, [defaultOpen]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // surrounding areas are tap targets for marking read
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="mt-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? 'rotate-90' : ''} rtl:-scale-x-100`}
        >
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t('english')}
      </button>

      {open && <div className="mt-1 border-s-2 border-[var(--color-line)] ps-3">{children}</div>}
    </>
  );
}
