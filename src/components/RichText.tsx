import type { RichRun } from '../lib/types.js';

interface RichTextProps {
  runs: readonly RichRun[];
  className?: string;
}

/**
 * Renders Rashi's structured runs. The bolded run is the dibur hamatchil — the
 * phrase the comment is about — which is how you find your place in Rashi.
 */
export function RichText({ runs, className = '' }: RichTextProps): React.JSX.Element {
  return (
    <p className={className}>
      {runs.map((run, i) =>
        run.b === true ? (
          <strong key={i} className="font-semibold text-[var(--color-gold)]">
            {run.t}{' '}
          </strong>
        ) : (
          <span key={i}>{run.t} </span>
        ),
      )}
    </p>
  );
}
