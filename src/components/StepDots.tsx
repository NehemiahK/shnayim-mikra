interface StepDotsProps {
  /** One entry per pass, in order. */
  states: readonly boolean[];
  label: string;
  onToggle: (index: number) => void;
  labels: readonly string[];
  /** Verse reference, appended so every dot has a unique accessible name. */
  context: string;
}

/**
 * The read-counter. Each dot is a real button so a reader can undo a single
 * pass without resetting the verse, and so screen readers can announce state.
 */
export function StepDots({ states, label, onToggle, labels, context }: StepDotsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      {states.map((done, i) => (
        <button
          key={i}
          type="button"
          aria-pressed={done}
          aria-label={`${label} ${labels[i] ?? String(i + 1)} ${context}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(i);
          }}
          className={`relative h-5 w-5 rounded-full border-2 transition-colors after:absolute after:-inset-3 after:content-[''] ${
            done
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
              : 'border-[var(--color-line)] bg-transparent'
          }`}
        />
      ))}
      <span className="hebrew-sm ms-1 text-[var(--color-muted)]" style={{ lineHeight: 1 }}>
        {label}
      </span>
    </div>
  );
}
