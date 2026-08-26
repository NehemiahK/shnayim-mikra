import type { ProgressSummary } from '../lib/reading-units.js';

export interface AliyahNavItem {
  key: string;
  slug: string;
  n: number;
  summary: ProgressSummary;
}

interface AliyahNavProps {
  /** Keyed `slug:aliyah`, in reading order. */
  aliyot: AliyahNavItem[];
  /** Display name per slug — required only when a combined week needs labelling. */
  names: Readonly<Record<string, string>>;
  showSlug: boolean;
  onJump: (key: string) => void;
  label: string;
}

const HEBREW_ORDINALS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'];

interface Group {
  slug: string;
  items: AliyahNavItem[];
}

/**
 * Consecutive items sharing a slug become one group. Items already arrive in
 * reading order (all of the first parsha's aliyot, then all of the second's),
 * so this never needs to look ahead past a slug change.
 */
export function groupBySlug(items: readonly AliyahNavItem[]): Group[] {
  const groups: Group[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.slug === item.slug) last.items.push(item);
    else groups.push({ slug: item.slug, items: [item] });
  }
  return groups;
}

/**
 * A combined week (e.g. Matot-Masei) doubles the aliyah count to 14, and
 * without a visible break it reads as "1234567" repeated — indistinguishable
 * from a rendering bug. Each parsha's run of aliyot gets its own name label
 * ahead of it; a single parsha renders exactly as before.
 */
export function AliyahNav({ aliyot, names, showSlug, onJump, label }: AliyahNavProps): React.JSX.Element {
  const groups = groupBySlug(aliyot);

  return (
    <nav aria-label={label} className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {groups.map((group) => (
        <div key={group.slug} className="flex shrink-0 items-center gap-1.5">
          {showSlug && (
            <span className="hebrew-sm shrink-0 whitespace-nowrap text-xs text-[var(--color-muted)]">
              {names[group.slug] ?? group.slug}
            </span>
          )}
          {group.items.map(({ key, slug, n, summary }) => {
            const complete = summary.fraction >= 1;
            const started = summary.done > 0;
            const ordinal = HEBREW_ORDINALS[n - 1] ?? String(n);
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onJump(key); }}
                aria-label={showSlug ? `${names[slug] ?? slug} ${String(n)}` : undefined}
                className={`relative min-h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors ${
                  complete
                    ? 'bg-[var(--color-accent)] text-white'
                    : started
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-ink)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-[var(--color-line)]'
                }`}
              >
                {ordinal}
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
        </div>
      ))}
    </nav>
  );
}
