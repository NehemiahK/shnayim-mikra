import { memo } from 'react';
import type { ParshaText, RashiComment, Verse } from '../lib/types.js';
import type { ReadingUnit } from '../lib/reading-units.js';
import { renderHebrew, type HebrewStyle } from '../lib/hebrew.js';
import { StepDots } from './StepDots.js';
import { RashiComments } from './RashiComments.js';
import { EnglishDisclosure } from './EnglishDisclosure.js';
import { RichText } from './RichText.js';
import type { TranslationKey } from '../i18n.js';
import type { TranslationPlacement } from '../store/settings.js';

export interface VerseCardProps {
  unit: ReadingUnit;
  parsha: ParshaText;
  hebrewStyle: HebrewStyle;
  translation: TranslationPlacement;
  rashiEnglish: boolean;
  onkelosEnglish: boolean;
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
  /** Marks every step of the verse done in one action, or undoes all of them. */
  onToggleAll: () => void;
}

function verseLabel(verse: Verse): string {
  return `${String(verse.c)}:${String(verse.v)}`;
}

function VerseCardImpl({
  unit,
  parsha,
  hebrewStyle,
  translation,
  rashiEnglish,
  onkelosEnglish,
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
  onToggleAll,
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
  const noneDone = !state.includes('1');
  const wholeVerseState: 'done' | 'partial' | 'empty' = allDone ? 'done' : noneDone ? 'empty' : 'partial';

  // Suppressed while expanded: the detail panel below already shows the
  // translation under its own heading, and two copies at once reads as a bug.
  const inlineTranslation = expanded ? 'off' : translation;
  const translationText = <p className="english text-[var(--color-muted)]">{verse.en}</p>;

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
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[var(--color-paper)] px-2 py-0.5 font-mono text-xs text-[var(--color-muted)]">
            {verseLabel(verse)}
          </span>
          {/*
            One tap for the whole verse — the per-step dots below stay for
            anyone tracking each reading individually, but reaching for three
            separate targets just to say "I read this" is real friction.
          */}
          <button
            type="button"
            role="checkbox"
            aria-checked={wholeVerseState === 'done' ? 'true' : wholeVerseState === 'partial' ? 'mixed' : 'false'}
            aria-label={`${t('markVerseDone')} ${verseLabel(verse)}`}
            onClick={onToggleAll}
            className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors after:absolute after:-inset-2 after:content-[''] ${
              wholeVerseState === 'done'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                : wholeVerseState === 'partial'
                  ? 'border-[var(--color-accent)] bg-transparent'
                  : 'border-[var(--color-line)] bg-transparent'
            }`}
          >
            {wholeVerseState === 'done' && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {wholeVerseState === 'partial' && (
              <span className="block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            )}
          </button>
        </div>
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
          {inlineTranslation === 'after' && <div className="mt-2">{translationText}</div>}
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
                  <>
                    <button
                      type="button"
                      onClick={() => { onToggleStep(step.id); }}
                      className="w-full cursor-pointer text-start"
                      aria-label={`${t('onkelos')} ${verseLabel(verse)}`}
                    >
                      <p className="hebrew-sm text-[var(--color-ink)]/90">{verse.on}</p>
                    </button>
                    {verse.oe.length > 0 && (
                      <EnglishDisclosure defaultOpen={onkelosEnglish} t={t}>
                        <RichText runs={verse.oe} className="english text-[var(--color-muted)]" />
                      </EnglishDisclosure>
                    )}
                  </>
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

      {inlineTranslation === 'end' && (
        <div className="mt-3 border-t border-[var(--color-line)] pt-3">{translationText}</div>
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
              {verse.oe.length > 0 && (
                <EnglishDisclosure defaultOpen={onkelosEnglish} t={t}>
                  <RichText runs={verse.oe} className="english text-[var(--color-muted)]" />
                </EnglishDisclosure>
              )}
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
