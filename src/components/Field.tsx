import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </h2>
      <div className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
        {children}
      </div>
    </section>
  );
}

export function Row({
  label,
  help,
  stacked = false,
  children,
}: {
  label: string;
  help?: string;
  /** Put the control on its own full-width line — for choices too wide to sit
   *  beside their label on a phone. */
  stacked?: boolean;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="px-4 py-3">
      <div className={stacked ? '' : 'flex items-center justify-between gap-4'}>
        <span className="text-sm font-medium">{label}</span>
        {stacked ? <div className="mt-2">{children}</div> : children}
      </div>
      {help !== undefined && <p className="mt-1.5 text-xs text-[var(--color-muted)]">{help}</p>}
    </div>
  );
}

interface ChoiceProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  /** Fill the available width, splitting it evenly between the options. */
  full?: boolean;
}

/** A segmented control — clearer than a select on a phone, and fully keyboardable. */
export function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
  full = false,
}: ChoiceProps<T>): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex gap-1 rounded-lg bg-[var(--color-paper)] p-1 ${
        full ? 'w-full' : 'flex-wrap justify-end'
      }`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => { onChange(option.value); }}
          className={`min-h-9 rounded-md px-3 text-sm transition-colors ${
            full ? 'flex-1 text-center' : ''
          } ${
            value === option.value
              ? 'bg-[var(--color-surface)] font-medium text-[var(--color-ink)] shadow-sm'
              : 'text-[var(--color-muted)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => { onChange(!checked); }}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-[inset-inline-start] ${
          checked ? 'start-6' : 'start-1'
        }`}
      />
    </button>
  );
}
