import { useEffect, useState } from 'react';
import type { RashiComment } from '../lib/types.js';
import { splitLeadingLemma } from '../lib/hebrew.js';
import { RichText } from './RichText.js';
import type { TranslationKey } from '../i18n.js';

export interface RashiCommentsProps {
  comments: readonly RashiComment[] | undefined;
  loading: boolean;
  /** Whether each comment starts with its English already open. */
  englishOpen: boolean;
  /**
   * Targum text to show instead of "no Rashi" when this verse has none.
   * Only pass this where Rashi is the assigned reading and skipping it would
   * leave nothing to read; the informational Rashi panel in the expanded
   * verse detail should keep saying there is no Rashi, since nothing there
   * is a required reading.
   */
  onkelosFallback?: string | undefined;
  t: (key: TranslationKey) => string;
}

/**
 * Rashi for one verse.
 *
 * The Hebrew is the reading; the English sits behind a per-comment disclosure
 * rather than stacked underneath it. Two directions of text in one column read
 * as clutter, and doubles the height of a commentary that is already the
 * longest thing on the page — so the translation is available in one tap but
 * costs nothing when it is not wanted.
 */
export function RashiComments({
  comments,
  loading,
  englishOpen,
  onkelosFallback,
  t,
}: RashiCommentsProps): React.JSX.Element {
  if (loading) {
    return <p className="text-sm text-[var(--color-muted)]">{t('loading')}…</p>;
  }
  if (!comments || comments.length === 0) {
    if (onkelosFallback !== undefined && onkelosFallback !== '') {
      return (
        <div>
          <p className="text-xs italic text-[var(--color-muted)]">{t('noRashiUsingTargum')}</p>
          <p className="hebrew-sm mt-1">{onkelosFallback}</p>
        </div>
      );
    }
    return <p className="text-sm italic text-[var(--color-muted)]">{t('noRashi')}</p>;
  }
  return (
    <div className="space-y-3">
      {comments.map((comment, i) => (
        <RashiEntry key={i} comment={comment} englishOpen={englishOpen} t={t} />
      ))}
    </div>
  );
}

function RashiEntry({
  comment,
  englishOpen,
  t,
}: {
  comment: RashiComment;
  englishOpen: boolean;
  t: (key: TranslationKey) => string;
}): React.JSX.Element {
  const [open, setOpen] = useState(englishOpen);

  // Follow the setting when it changes, without discarding a manual toggle.
  useEffect(() => { setOpen(englishOpen); }, [englishOpen]);

  const { lemma, rest } = splitLeadingLemma(comment.en);
  const hasEnglish = comment.en.length > 0;

  return (
    <div>
      {comment.he.length > 0 && <RichText runs={comment.he} className="hebrew-sm" />}

      {hasEnglish && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); // the whole card is a tap target for marking read
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

          {open && (
            <div className="mt-1 border-s-2 border-[var(--color-line)] ps-3">
              {lemma !== '' && (
                <p
                  dir="rtl"
                  className="hebrew-sm font-semibold text-[var(--color-gold)]"
                  style={{ lineHeight: 1.7 }}
                >
                  {lemma}
                </p>
              )}
              {rest.length > 0 && (
                <RichText runs={rest} className="english text-[var(--color-muted)]" />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
