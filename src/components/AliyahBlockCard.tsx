import { memo } from 'react';
import type { ParshaText, RashiText } from '../lib/types.js';
import type { ReadingUnit } from '../lib/reading-units.js';
import { renderHebrew, type HebrewStyle } from '../lib/hebrew.js';
import { RichText } from './RichText.js';
import type { TranslationKey } from '../i18n.js';

export interface AliyahBlockCardProps {
  unit: ReadingUnit;
  parsha: ParshaText;
  hebrewStyle: HebrewStyle;
  showTranslation: boolean;
  done: boolean;
  rashi: RashiText | undefined;
  rashiLoading: boolean;
  t: (key: TranslationKey) => string;
  onToggle: () => void;
}

/** One whole-aliyah reading pass: the full run of verses, marked complete once. */
function AliyahBlockCardImpl({
  unit,
  parsha,
  hebrewStyle,
  showTranslation,
  done,
  rashi,
  rashiLoading,
  t,
  onToggle,
}: AliyahBlockCardProps): React.JSX.Element {
  const step = unit.steps[0];
  const kind = step?.kind ?? 'mikra';
  const heading =
    kind === 'mikra'
      ? `${t('mikra')} · ${step && step.pass > 1 ? t('secondReading') : t('firstReading')}`
      : kind === 'rashi'
        ? t('rashi')
        : t('onkelos');

  return (
    <article
      id={`unit-${unit.id}`}
      className={`scroll-mt-28 rounded-xl border bg-[var(--color-surface)] transition-colors ${
        done ? 'border-[var(--color-accent)]/40' : 'border-[var(--color-line)]'
      }`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{heading}</p>
          <p className="text-xs text-[var(--color-muted)]">
            {t('aliyah')} {unit.aliyah} · {unit.verses.length} {t('verses')}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors ${
            done
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-paper)] text-[var(--color-ink)] ring-1 ring-[var(--color-line)]'
          }`}
        >
          {t('done')}
        </button>
      </header>

      <div className="space-y-3 p-4">
        {unit.verses.map((index) => {
          const verse = parsha.verses[index];
          if (!verse) return null;
          const key = `${String(verse.c)}:${String(verse.v)}`;
          return (
            <div key={key} className="flex gap-3">
              <span className="mt-1 shrink-0 font-mono text-[0.65rem] text-[var(--color-muted)]">
                {verse.v}
              </span>
              <div className="min-w-0 flex-1">
                {kind === 'mikra' && <p className="hebrew">{renderHebrew(verse.he, hebrewStyle)}</p>}
                {kind === 'onkelos' && <p className="hebrew-sm">{verse.on}</p>}
                {kind === 'rashi' && (
                  <RashiForVerse
                    comments={rashi?.comments[key]}
                    loading={rashiLoading}
                    empty={t('noRashi')}
                  />
                )}
                {showTranslation && kind === 'mikra' && (
                  <p className="english mt-1 text-[var(--color-muted)]">{verse.en}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function RashiForVerse({
  comments,
  loading,
  empty,
}: {
  comments: RashiText['comments'][string] | undefined;
  loading: boolean;
  empty: string;
}): React.JSX.Element {
  if (loading) return <p className="text-sm text-[var(--color-muted)]">…</p>;
  if (!comments || comments.length === 0) {
    return <p className="text-sm italic text-[var(--color-muted)]">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {comments.map((comment, i) => (
        <div key={i}>
          {comment.he.length > 0 && <RichText runs={comment.he} className="hebrew-sm" />}
          {comment.en.length > 0 && (
            <RichText runs={comment.en} className="english mt-1 text-[var(--color-muted)]" />
          )}
        </div>
      ))}
    </div>
  );
}

export const AliyahBlockCard = memo(AliyahBlockCardImpl);
