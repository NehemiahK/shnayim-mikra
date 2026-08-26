import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  PARSHIYOT,
  bookRows,
  parshaMeta,
  readingForDate,
  resolveParsha,
  upcomingReadings,
} from '../lib/calendar.js';
import { BOOKS, type Book } from '../lib/types.js';
import { mostRecentUnfinished, useProgress } from '../store/progress.js';
import { useSettings } from '../store/settings.js';
import { useT } from '../hooks/useT.js';
import { AppBar, GearIcon, IconLink, Page } from '../components/Layout.js';
import { ProgressRing } from '../components/Progress.js';

function formatShabbat(date: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function Home(): React.JSX.Element {
  const { t, lang } = useT();
  const region = useSettings((s) => s.settings.region);
  const summaries = useProgress((s) => s.summaries);
  const [openBook, setOpenBook] = useState<Book | null>(null);

  const today = useMemo(() => new Date(), []);
  const thisWeek = readingForDate(today, region);
  const upcoming = useMemo(
    () => upcomingReadings(today, region, 6).slice(1),
    [today, region],
  );
  const resumeSlug = mostRecentUnfinished(summaries);

  const fractionFor = (slug: string): number => {
    const s = summaries[slug];
    return s && s.total > 0 ? s.done / s.total : 0;
  };

  return (
    <Page>
      <AppBar
        title={t('appName')}
        subtitle={t('tagline')}
        actions={
          <>
            <IconLink href="/about" label={t('about')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </IconLink>
            <IconLink href="/settings" label={t('settings')}>
              <GearIcon />
            </IconLink>
          </>
        }
      />

      {thisWeek && <WeekCard slug={thisWeek.slug} date={thisWeek.shabbat} label={t('thisShabbat')} lang={lang} fraction={fractionFor(thisWeek.slug)} cta={fractionFor(thisWeek.slug) > 0 ? t('continueReading') : t('startReading')} />}

      {resumeSlug !== undefined && resumeSlug !== thisWeek?.slug && (
        <section className="mt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {t('continueReading')}
          </h2>
          <ParshaRow slug={resumeSlug} fraction={fractionFor(resumeSlug)} />
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {t('upcoming')}
        </h2>
        <ul className="space-y-2">
          {upcoming.map((reading) => (
            <li key={`${reading.slug}-${reading.shabbat.toISOString()}`}>
              <ParshaRow
                slug={reading.slug}
                fraction={fractionFor(reading.slug)}
                trailing={formatShabbat(reading.shabbat, lang)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {t('allParshiyot')}
        </h2>
        <div className="space-y-2">
          {BOOKS.map((book) => {
            // A combined week's own row sits right after its second half, so
            // a reader can jump straight to however that week is actually
            // read without knowing in advance whether this year doubles it.
            const rows = bookRows(book);
            const singleCount = PARSHIYOT.filter((p) => p.book === book).length;
            const open = openBook === book;
            return (
              <div key={book} className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
                <button
                  type="button"
                  onClick={() => { setOpenBook(open ? null : book); }}
                  aria-expanded={open}
                  className="flex min-h-12 w-full items-center justify-between px-4 text-start"
                >
                  <span className="font-medium">{book}</span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {singleCount} · {open ? '−' : '+'}
                  </span>
                </button>
                {open && (
                  <ul className="border-t border-[var(--color-line)]">
                    {rows.map((row) => (
                      <li key={row.slug} className="border-b border-[var(--color-line)] last:border-0">
                        <Link
                          href={`/p/${row.slug}`}
                          className="flex min-h-12 items-center justify-between gap-3 px-4"
                        >
                          <span className="min-w-0">
                            <span className="hebrew-sm flex items-center gap-1.5 truncate">
                              {row.nameHe}
                              {row.isCombo && (
                                <span className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[0.65rem] font-sans font-medium text-[var(--color-accent)]">
                                  {t('combined')}
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-[var(--color-muted)]">
                              {row.nameEn} · {row.subtitle}
                              {row.slug === 'vzot-haberachah' ? ` · ${t('simchatTorah')}` : ''}
                            </span>
                          </span>
                          <ProgressRing fraction={fractionFor(row.slug)} size={28} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </Page>
  );
}

function WeekCard({
  slug,
  date,
  label,
  lang,
  fraction,
  cta,
}: {
  slug: string;
  date: Date;
  label: string;
  lang: string;
  fraction: number;
  cta: string;
}): React.JSX.Element | null {
  const resolved = resolveParsha(slug);
  if (!resolved) return null;
  return (
    <Link
      href={`/p/${slug}`}
      className="block rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {label} · {formatShabbat(date, lang)}
          </p>
          <p className="hebrew mt-1 truncate" style={{ lineHeight: 1.4 }}>
            {resolved.nameHe}
          </p>
          <p className="mt-0.5 truncate text-sm text-[var(--color-muted)]">{resolved.nameEn}</p>
        </div>
        <ProgressRing fraction={fraction} size={52} />
      </div>
      <span className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 font-medium text-white">
        {cta}
      </span>
    </Link>
  );
}

function ParshaRow({
  slug,
  fraction,
  trailing,
}: {
  slug: string;
  fraction: number;
  trailing?: string;
}): React.JSX.Element | null {
  const resolved = resolveParsha(slug);
  if (!resolved) return null;
  const meta = parshaMeta(resolved.parts[0] ?? '');
  return (
    <Link
      href={`/p/${slug}`}
      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4"
    >
      <span className="min-w-0">
        <span className="hebrew-sm block truncate">{resolved.nameHe}</span>
        <span className="block truncate text-xs text-[var(--color-muted)]">
          {resolved.nameEn}
          {meta ? ` · ${meta.book}` : ''}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {trailing !== undefined && (
          <span className="text-xs text-[var(--color-muted)]">{trailing}</span>
        )}
        <ProgressRing fraction={fraction} size={28} />
      </span>
    </Link>
  );
}
