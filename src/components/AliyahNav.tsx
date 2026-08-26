import type { ProgressSummary } from '../lib/reading-units.js';

interface AliyahNavProps {
  /** Keyed `slug:aliyah`, in reading order. */
  aliyot: { key: string; slug: string; n: number; summary: ProgressSummary }[];
  showSlug: boolean;
  onJump: (key: string) => void;
  label: string;
}

const HEBREW_ORDINALS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'];

export function AliyahNav({ aliyot, showSlug, onJump, label }: AliyahNavProps): React.JSX.Element {
  return (
    <nav aria-label={label} className="flex gap-1.5 overflow-x-auto pb-1">
      {aliyot.map(({ key, slug, n, summary }) => {
        const complete = summary.fraction >= 1;
        const started = summary.done > 0;
        return (
          <button
            key={key}
            type="button"
            onClick={() => { onJump(key); }}
            title={showSlug ? slug : undefined}
            className={`relative min-h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors ${
              complete
                ? 'bg-[var(--color-accent)] text-white'
                : started
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-ink)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-[var(--color-line)]'
            }`}
          >
            {HEBREW_ORDINALS[n - 1] ?? n}
            {!complete && started && (
              <span className="absolute inset-x-1 bottom-1 h-0.5 overflow-hidden rounded-full bg-[var(--color-line)]">
                <span
                  className="block h-full bg-[var(--color-accent)]"
                  style={{ width: `${String(Math.round(summary.fraction * 100))}%` }}
                />
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
