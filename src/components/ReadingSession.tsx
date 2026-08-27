import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ParshaText, RashiText } from '../lib/types.js';
import {
  buildReadingUnits,
  nextIncomplete,
  summarize,
  summarizeByAliyah,
  type ReadingUnit,
} from '../lib/reading-units.js';
import { loadRashi } from '../lib/data.js';
import { revealElement } from '../lib/scroll.js';
import { useProgress } from '../store/progress.js';
import { useSettings } from '../store/settings.js';
import { useT } from '../hooks/useT.js';
import { VerseCard } from './VerseCard.js';
import { AliyahBlockCard } from './AliyahBlockCard.js';
import { AliyahNav } from './AliyahNav.js';
import { ProgressBar } from './Progress.js';
import { Choice } from './Field.js';

interface ReadingSessionProps {
  parts: ParshaText[];
  title: string;
}

export function ReadingSession({ parts, title }: ReadingSessionProps): React.JSX.Element {
  const { t, lang } = useT();
  const settings = useSettings((s) => s.settings);
  const setSetting = useSettings((s) => s.set);
  const done = useProgress((s) => s.done);
  const toggle = useProgress((s) => s.toggle);
  const setDone = useProgress((s) => s.setDone);
  const syncSummary = useProgress((s) => s.syncSummary);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [rashi, setRashi] = useState<Record<string, RashiText>>({});
  const [rashiLoading, setRashiLoading] = useState(false);
  const pendingScroll = useRef(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Only meaningful when Rashi is the *sole* third reading — in "both" mode
  // Onkelos already has its own dedicated step, so falling back to it again
  // under a Rashi-less verse would just show it twice. The setting itself
  // stays on if the reader switches modes and back, so this is resolved once
  // here rather than re-derived (and easy to get wrong) in each card.
  const rashiFallbackActive = settings.targum === 'rashi' && settings.rashiFallbackToOnkelos;

  const units = useMemo(
    () =>
      buildReadingUnits(parts, {
        structure: settings.structure,
        targum: settings.targum,
        mikraRepetitions: settings.mikraRepetitions,
      }),
    [parts, settings.structure, settings.targum, settings.mikraRepetitions],
  );

  const byId = useMemo(() => new Map(parts.map((p) => [p.slug, p])), [parts]);
  const navNames = useMemo(
    () =>
      Object.fromEntries(parts.map((p) => [p.slug, lang === 'he' ? p.nameHe : p.nameEn])),
    [parts, lang],
  );
  const isDone = useCallback((id: string) => done.has(id), [done]);
  const total = useMemo(() => summarize(units, isDone), [units, isDone]);
  const aliyot = useMemo(() => summarizeByAliyah(units, isDone), [units, isDone]);

  // Rashi is a separate download; fetch it only once it is actually needed.
  const needsRashi = settings.targum === 'rashi' || settings.targum === 'both' || expanded !== null;
  useEffect(() => {
    if (!needsRashi) return;
    const missing = parts.filter((p) => !(p.slug in rashi));
    if (missing.length === 0) return;

    let cancelled = false;
    setRashiLoading(true);
    Promise.all(missing.map((p) => loadRashi(p.slug)))
      .then((loaded) => {
        if (cancelled) return;
        setRashi((prev) => ({
          ...prev,
          ...Object.fromEntries(loaded.map((r) => [r.slug, r])),
        }));
      })
      .catch(() => { /* Rashi is supplementary; the reading still works without it */ })
      .finally(() => { if (!cancelled) setRashiLoading(false); });

    return () => { cancelled = true; };
  }, [needsRashi, parts, rashi]);

  useEffect(() => { syncSummary(total.total); }, [syncSummary, total.total, total.done]);

  const handleToggle = useCallback(
    (stepId: string) => { toggle(stepId); },
    [toggle],
  );

  const handleAdvance = useCallback(
    (unit: ReadingUnit, kind: 'mikra' | 'targum') => {
      const current = useProgress.getState().done;
      const candidates = unit.steps.filter((s) =>
        kind === 'mikra' ? s.kind === 'mikra' : s.kind !== 'mikra',
      );
      const next = candidates.find((s) => !current.has(s.id));
      if (!next) return;
      setDone([next.id], true);
    },
    [setDone],
  );

  // Marks (or un-marks) every step of one unit at once — the mobile "just get
  // through this verse" checkbox, and what the keyboard shortcut below acts on.
  const handleToggleAll = useCallback(
    (unit: ReadingUnit) => {
      const ids = unit.steps.map((s) => s.id);
      const current = useProgress.getState().done;
      const wasAllDone = ids.every((id) => current.has(id));
      setDone(ids, !wasAllDone);
    },
    [setDone],
  );

  // Space (or Enter) checks off one reading — the next unread step, not the
  // whole verse. Pressing it mirrors what you actually did: read the Hebrew,
  // press; read it again, press; read the Targum, press. Guarded to only fire
  // when nothing more specific already has focus, so tabbing to a single dot
  // on purpose and pressing Space there still toggles just that dot.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;

      // Read progress from the store, not the render closure: presses arrive
      // faster than React re-renders, and a stale closure would keep handing
      // back the same "next" step, so holding the key down would mark one
      // reading over and over instead of advancing. Same failure mode the
      // rapid-tap handlers above are written to avoid.
      const current = useProgress.getState().done;
      const next = nextIncomplete(units, (id) => current.has(id));
      if (!next) return;
      e.preventDefault();
      setDone([next.step.id], true);
      pendingScroll.current = true;
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, [units, setDone]);

  // Keep whatever should be read next in view after a keyboard press — but
  // only when it isn't already, which while working down a verse is most of
  // the time. Deliberately not wired to taps: a reader who just tapped
  // something is already looking at it, and moving the page under them was
  // the thing that made the old always-scroll behaviour intrusive.
  useEffect(() => {
    if (!pendingScroll.current) return;
    pendingScroll.current = false;
    const next = nextIncomplete(units, isDone);
    if (!next) return;
    const el = document.getElementById(`unit-${next.unit.id}`);
    if (el) revealElement(el, headerRef.current);
  }, [units, isDone]);

  const navItems = useMemo(
    () =>
      [...aliyot.entries()].map(([key, summary]) => {
        const [slug = '', n = '1'] = key.split(':');
        return { key, slug, n: Number(n), summary };
      }),
    [aliyot],
  );

  // Explicit navigation, not "auto" scroll: the reader tapped this specific
  // aliyah number and asked to go there. Instant rather than smooth because
  // an aliyah can be thousands of pixels away, and animating that far is slow
  // and disorienting rather than pleasant.
  const jump = useCallback(
    (key: string) => {
      const first = units.find((u) => `${u.slug}:${String(u.aliyah)}` === key);
      if (first) document.getElementById(`unit-${first.id}`)?.scrollIntoView({ block: 'start', behavior: 'instant' });
    },
    [units],
  );

  return (
    <div>
      <div
        ref={headerRef}
        className="sticky top-0 z-10 -mx-4 mb-4 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 px-4 pb-3 pt-2 backdrop-blur"
      >
        {/*
          Reachable here, not only in Settings — switching mid-parsha (e.g. a
          verse turns out to have no Rashi) shouldn't mean navigating away
          from the reading. Settings' own copy of this control reads and
          writes the exact same setting, so the two can never disagree.
        */}
        <Choice
          label={t('targumSource')}
          full
          value={settings.targum}
          onChange={(v) => { setSetting('targum', v); }}
          options={[
            { value: 'onkelos', label: t('onkelos') },
            { value: 'rashi', label: t('rashi') },
            { value: 'both', label: t('both') },
          ]}
        />
        <div className="mt-2">
          <AliyahNav
            aliyot={navItems}
            names={navNames}
            showSlug={parts.length > 1}
            onJump={jump}
            label={`${title} — ${t('aliyot')}`}
          />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar fraction={total.fraction} />
          <span className="shrink-0 font-mono text-xs text-[var(--color-muted)]">
            {total.done}/{total.total}
          </span>
        </div>
        {/* No physical spacebar on a touchscreen, so this only ever shows up
            for a mouse/trackpad + keyboard setup — never adds clutter on mobile. */}
        <p className="kbd-hint mt-1 text-xs text-[var(--color-muted)]">{t('keyboardHint')}</p>
      </div>

      <div className="space-y-3 pb-24">
        {units.map((unit) => {
          const parsha = byId.get(unit.slug);
          if (!parsha) return null;
          const state = unit.steps.map((s) => (done.has(s.id) ? '1' : '0')).join('');

          if (settings.structure === 'aliyah') {
            const step = unit.steps[0];
            return (
              <AliyahBlockCard
                key={unit.id}
                unit={unit}
                parsha={parsha}
                hebrewStyle={settings.hebrewStyle}
                showTranslation={settings.showTranslation}
                rashiEnglish={settings.rashiEnglish}
                rashiFallbackToOnkelos={rashiFallbackActive}
                done={state === '1'}
                rashi={rashi[unit.slug]}
                rashiLoading={rashiLoading}
                t={t}
                onToggle={() => { if (step) handleToggle(step.id); }}
              />
            );
          }

          const verseIndex = unit.verses[0];
          const verse = verseIndex === undefined ? undefined : parsha.verses[verseIndex];
          const key = verse ? `${String(verse.c)}:${String(verse.v)}` : '';
          return (
            <VerseCard
              key={unit.id}
              unit={unit}
              parsha={parsha}
              hebrewStyle={settings.hebrewStyle}
              showTranslation={settings.showTranslation}
              rashiEnglish={settings.rashiEnglish}
              rashiFallbackToOnkelos={rashiFallbackActive}
              parallel={settings.parallel}
              state={state}
              expanded={expanded === unit.id}
              rashi={rashi[unit.slug]?.comments[key]}
              rashiLoading={rashiLoading}
              t={t}
              onToggleStep={(stepId) => { handleToggle(stepId); }}
              onAdvance={(kind) => { handleAdvance(unit, kind); }}
              onToggleExpand={() => { setExpanded((cur) => (cur === unit.id ? null : unit.id)); }}
              onToggleAll={() => { handleToggleAll(unit); }}
            />
          );
        })}
      </div>
    </div>
  );
}
