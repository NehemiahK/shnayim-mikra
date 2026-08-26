interface ProgressBarProps {
  fraction: number;
  className?: string;
}

export function ProgressBar({ fraction, className = '' }: ProgressBarProps): React.JSX.Element {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-line)] ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
        style={{ width: `${String(pct)}%` }}
      />
    </div>
  );
}

interface ProgressRingProps {
  fraction: number;
  size?: number;
  label?: string;
}

export function ProgressRing({ fraction, size = 44, label }: ProgressRingProps): React.JSX.Element {
  const clamped = Math.min(1, Math.max(0, fraction));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const complete = clamped >= 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label={label ?? `${String(Math.round(clamped * 100))}%`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        transform={`rotate(-90 ${String(size / 2)} ${String(size / 2)})`}
        className="transition-[stroke-dashoffset] duration-300"
      />
      {complete ? (
        <path
          d={`M ${String(size * 0.32)} ${String(size * 0.52)} l ${String(size * 0.12)} ${String(size * 0.12)} l ${String(size * 0.24)} ${String(size * -0.26)}`}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke - 0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-[var(--color-muted)]"
          style={{ fontSize: size * 0.3 }}
        >
          {Math.round(clamped * 100)}
        </text>
      )}
    </svg>
  );
}
