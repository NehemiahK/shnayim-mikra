import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { resolveParsha } from '../lib/calendar.js';
import { loadParshiyot } from '../lib/data.js';
import type { ParshaText } from '../lib/types.js';
import { useProgress } from '../store/progress.js';
import { useT } from '../hooks/useT.js';
import { AppBar, GearIcon, IconLink, Page } from '../components/Layout.js';
import { ReadingSession } from '../components/ReadingSession.js';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; parts: ParshaText[] };

export function Reader({ slug }: { slug: string }): React.JSX.Element {
  const { t } = useT();
  const open = useProgress((s) => s.open);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // Memoized so it is a stable dependency for the load effect below.
  const resolved = useMemo(() => resolveParsha(slug), [slug]);

  useEffect(() => {
    if (resolved) open(slug);
  }, [resolved, open, slug]);

  useEffect(() => {
    if (!resolved) return;
    let cancelled = false;
    setState({ status: 'loading' });
    loadParshiyot(resolved.parts)
      .then((parts) => { if (!cancelled) setState({ status: 'ready', parts }); })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [resolved, attempt]);

  if (!resolved) {
    return (
      <Page>
        <AppBar title={t('notFound')} back="/" backLabel={t('back')} />
        <Link href="/" className="text-[var(--color-accent)] underline">
          {t('goHome')}
        </Link>
      </Page>
    );
  }

  return (
    <Page>
      <AppBar
        title={<span className="hebrew-sm" style={{ fontSize: '1.25rem' }}>{resolved.nameHe}</span>}
        subtitle={resolved.nameEn}
        back="/"
        backLabel={t('back')}
        actions={
          <IconLink href="/settings" label={t('settings')}>
            <GearIcon />
          </IconLink>
        }
      />

      {state.status === 'loading' && (
        <div className="space-y-3" aria-busy="true" aria-label={t('loading')}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]"
            />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center">
          <p className="mb-4 text-[var(--color-muted)]">{t('loadFailed')}</p>
          <button
            type="button"
            onClick={() => { setAttempt((a) => a + 1); }}
            className="min-h-11 rounded-xl bg-[var(--color-accent)] px-5 font-medium text-white"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <ReadingSession
          parts={state.parts}
          title={resolved.nameEn}
          comboAliyot={resolved.comboAliyot}
        />
      )}
    </Page>
  );
}
