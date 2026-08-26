import { memo } from 'react';
import type { ParshaText, RashiComment, Verse } from '../lib/types.js';
import type { ReadingUnit } from '../lib/reading-units.js';
import { renderHebrew, type HebrewStyle } from '../lib/hebrew.js';
import { StepDots } from './StepDots.js';
import { RashiComments } from './RashiComments.js';
import type { TranslationKey } from '../i18n.js';

export interface VerseCardProps {
  unit: ReadingUnit;
  parsha: ParshaText;
  hebrewStyle: HebrewStyle;
  showTranslation: boolean;
  rashiEnglish: boolean;
  rashiFallbackToOnkelos: boolean;
  parallel: boolean;
  /** `1` for each completed step of the unit, `0` otherwise — memo key. */
  state: string;
  expanded: boolean;
  rashi: readonly RashiComment[] | undefined;
  rashiLoading: boolean;
  t: (key: TranslationKey) => string;
  onToggleStep: (stepId: string) => void;
  onAdvance: (kind: 'mikra' | 'targum') => void;
  onToggleExpand: () => void;
}

function verseLabel(verse: Verse): string {
  return `${String(verse.c)}:${String(verse.v)}`;
}

function VerseCardImpl({
  unit,
  parsha,
  hebrewStyle,
  showTranslation,
  rashiEnglish,
  rashiFallbackToOnkelos,
  parallel,
  state,
  expanded,
  rashi,
  rashiLoading,
  t,
  onToggleStep,
  onAdvance,
  onToggleExpand,
}: VerseCardProps): React.JSX.Element | null {
  const index = unit.verses[0];
  const verse = index === undefined ? undefined : parsha.verses[index];
  if (!verse) return null;

  const mikraSteps = unit.steps.filter((s) => s.kind === 'mikra');
  const targumSteps = unit.steps.filter((s) => s.kind !== 'mikra');
  const isDone = (id: string): boolean => {
    const i = unit.steps.findIndex((s) => s.id === id);
    return state[i] === '1';
  };

  const passLabels = [t('firstReading'), t('secondReading'), '3'];
  const allDone = !state.includes('0');

  // When Rashi is the assigned third reading but this verse has none, the
  // fallback substitutes Onkelos so the reading is never left empty — the
  // dot's label must track whichever text is actually being shown.
  const rashiFallenBack = (!rashi || rashi.length === 0) && rashiFallbackToOnkelos;
  const targumLabel = (kind: 'onkelos' | 'rashi'): string =>
    kind === 'rashi' && rashiFallenBack ? t('onkelos') : kind === 'rashi' ? t('rashi') : t('onkelos');

  return (
    <article
      id={`unit-${unit.id}`}
      className={`scroll-mt-28 rounded-xl border bg-[var(--color-surface)] p-4 transition-colors ${
        allDone ? 'border-[var(--color-accent)]/40' : 'border-[var(--color-line)]'
      }`}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-md bg-[var(--color-paper)] px-2 py-0.5 font-mono text-xs text-[var(--color-muted)]">
          {verseLabel(verse)}
        </span>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-controls={`detail-${unit.id}`}
          className="flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          {expanded ? t('showLess') : t('showMore')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d={expanded ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <div className={parallel ? 'gap-5 md:grid md:grid-cols-2' : ''}>
        {/* Mikra — tapping the text completes the next unread pass. */}
        <section>
          <button
            type="button"
            onClick={() => { onAdvance('mikra'); }}
            className="w-full cursor-pointer text-start"
            aria-label={`${t('mikra')} ${verseLabel(verse)}`}
          >
            <p className="hebrew">{renderHebrew(verse.he, hebrewStyle)}</p>
          </button>
          <div className="mt-2">
            <StepDots
              label={t('mikra')}
              context={verseLabel(verse)}
              labels={passLabels}
              states={mikraSteps.map((s) => isDone(s.id))}
              onToggle={(i) => {
                const step = mikraSteps[i];
                if (step) onToggleStep(step.id);
              }}
            />
          </div>
        </section>

        {targumSteps.length > 0 && (
          <section className={parallel ? 'mt-4 md:mt-0' : 'mt-4 border-t border-[var(--color-line)] pt-4'}>
            {targumSteps.map((step) => (
              <div key={step.id} className="mb-3 last:mb-0">
                {/*
                  Onkelos is plain text, so the whole passage is a tap target.
                  Rashi contains its own English disclosure, and an interactive
                  element cannot sit inside a button — nor should tapping a
                  passage mean two different things. There, the dot is the control.
                */}
                {step.kind === 'onkelos' ? (
                  <button
                    type="button"
                    onClick={() => { onToggleStep(step.id); }}
                    className="w-full cursor-pointer text-start"
                    aria-label={`${t('onkelos')} ${verseLabel(verse)}`}
                  >
                    <p className="hebrew-sm text-[var(--color-ink)]/90">{verse.on}</p>
                  </button>
                ) : (
                  <RashiComments
                    comments={rashi}
                    loading={rashiLoading}
                    englishOpen={rashiEnglish}
                    onkelosFallback={rashiFallbackToOnkelos ? verse.on : undefined}
                    t={t}
                  />
                )}
                <div className="mt-2">
                  {/*
                    When this verse has no Rashi and the fallback kicked in,
                    the dot should say what is actually being read here.
                  */}
                  <StepDots
                    label={targumLabel(step.kind === 'rashi' ? 'rashi' : 'onkelos')}
                    context={verseLabel(verse)}
                    labels={['1']}
                    states={[isDone(step.id)]}
                    onToggle={() => { onToggleStep(step.id); }}
                  />
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {showTranslation && !expanded && (
        <p className="english mt-3 border-t border-[var(--color-line)] pt-3 text-[var(--color-muted)]">
          {verse.en}
        </p>
      )}

      {expanded && (
        <div
          id={`detail-${unit.id}`}
          className="mt-4 space-y-4 border-t border-[var(--color-line)] pt-4"
        >
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {t('translation')}
            </h3>
            <p className="english">{verse.en}</p>
          </div>
          {!targumSteps.some((s) => s.kind === 'onkelos') && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {t('onkelos')}
              </h3>
              <p className="hebrew-sm">{verse.on}</p>
            </div>
          )}
          {!targumSteps.some((s) => s.kind === 'rashi') && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {t('rashi')}
              </h3>
              <RashiComments
                      comments={rashi}
                      loading={rashiLoading}
                      englishOpen={rashiEnglish}
                      t={t}
                    />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Re-rendering every verse of a 200-verse parsha on each tap is wasteful, so
 * the card is memoized on a compact string of its own step states.
 */
export const VerseCard = memo(VerseCardImpl);
