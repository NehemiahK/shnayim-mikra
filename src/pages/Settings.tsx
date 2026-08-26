import { useState } from 'react';
import { DEFAULT_SETTINGS, FONT_SCALE_RANGE, useSettings } from '../store/settings.js';
import { useProgress } from '../store/progress.js';
import { PARSHIYOT } from '../lib/calendar.js';
import { prefetchAll } from '../lib/data.js';
import { renderHebrew } from '../lib/hebrew.js';
import { useT } from '../hooks/useT.js';
import { AppBar, Page } from '../components/Layout.js';
import { Choice, Row, Section, Toggle } from '../components/Field.js';

const SAMPLE = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';

export function Settings(): React.JSX.Element {
  const { t } = useT();
  const settings = useSettings((s) => s.settings);
  const set = useSettings((s) => s.set);
  const resetSettings = useSettings((s) => s.reset);
  const summaries = useProgress((s) => s.summaries);
  const resetReading = useProgress((s) => s.resetReading);
  const [download, setDownload] = useState<{ done: number; total: number } | null>(null);

  const startDownload = (): void => {
    setDownload({ done: 0, total: PARSHIYOT.length * 2 });
    void prefetchAll(
      PARSHIYOT.map((p) => p.slug),
      (done, total) => { setDownload({ done, total }); },
    );
  };

  return (
    <Page>
      <AppBar title={t('settings')} back="/" backLabel={t('back')} />

      <div className="mb-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <p className="hebrew" aria-label="preview">
          {renderHebrew(SAMPLE, settings.hebrewStyle)}
        </p>
      </div>

      <Section title={t('sectionReading')}>
        <Row stacked label={t('structure')} help={t('structureHelp')}>
          <Choice
            label={t('structure')}
            full
            value={settings.structure}
            onChange={(v) => { set('structure', v); }}
            options={[
              { value: 'verse', label: t('structureVerse') },
              { value: 'aliyah', label: t('structureAliyah') },
            ]}
          />
        </Row>
        <Row stacked label={t('targumSource')} help={t('targumHelp')}>
          <Choice
            label={t('targumSource')}
            full
            value={settings.targum}
            onChange={(v) => { set('targum', v); }}
            options={[
              { value: 'onkelos', label: t('onkelos') },
              { value: 'rashi', label: t('rashi') },
              { value: 'both', label: t('targumBoth') },
            ]}
          />
        </Row>
        <Row label={t('repetitions')} help={t('repetitionsHelp')}>
          <Choice
            label={t('repetitions')}
            value={String(settings.mikraRepetitions)}
            onChange={(v) => { set('mikraRepetitions', Number(v)); }}
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
          />
        </Row>
      </Section>

      <Section title={t('sectionText')}>
        <Row stacked label={t('hebrewStyle')}>
          <Choice
            label={t('hebrewStyle')}
            full
            value={settings.hebrewStyle}
            onChange={(v) => { set('hebrewStyle', v); }}
            options={[
              { value: 'taamim', label: t('styleTaamim') },
              { value: 'nikud', label: t('styleNikud') },
              { value: 'plain', label: t('stylePlain') },
            ]}
          />
        </Row>
        <Row label={t('fontSize')}>
          <input
            type="range"
            min={FONT_SCALE_RANGE.min}
            max={FONT_SCALE_RANGE.max}
            step={FONT_SCALE_RANGE.step}
            value={settings.fontScale}
            aria-label={t('fontSize')}
            onChange={(e) => { set('fontScale', Number(e.target.value)); }}
            className="w-40 accent-[var(--color-accent)]"
          />
        </Row>
        <Row label={t('showTranslation')} help={t('showTranslationHelp')}>
          <Toggle
            label={t('showTranslation')}
            checked={settings.showTranslation}
            onChange={(v) => { set('showTranslation', v); }}
          />
        </Row>
        <Row label={t('parallel')} help={t('parallelHelp')}>
          <Toggle
            label={t('parallel')}
            checked={settings.parallel}
            onChange={(v) => { set('parallel', v); }}
          />
        </Row>
        <Row stacked label={t('theme')}>
          <Choice
            label={t('theme')}
            full
            value={settings.theme}
            onChange={(v) => { set('theme', v); }}
            options={[
              { value: 'light', label: t('themeLight') },
              { value: 'dark', label: t('themeDark') },
              { value: 'system', label: t('themeSystem') },
            ]}
          />
        </Row>
      </Section>

      <Section title={t('sectionBehaviour')}>
        <Row label={t('autoAdvance')}>
          <Toggle
            label={t('autoAdvance')}
            checked={settings.autoAdvance}
            onChange={(v) => { set('autoAdvance', v); }}
          />
        </Row>
        <Row stacked label={t('region')} help={t('regionHelp')}>
          <Choice
            label={t('region')}
            full
            value={settings.region}
            onChange={(v) => { set('region', v); }}
            options={[
              { value: 'diaspora', label: t('regionDiaspora') },
              { value: 'israel', label: t('regionIsrael') },
            ]}
          />
        </Row>
        <Row label={t('language')}>
          <Choice
            label={t('language')}
            value={settings.uiLang}
            onChange={(v) => { set('uiLang', v); }}
            options={[
              { value: 'en', label: 'English' },
              { value: 'he', label: 'עברית' },
            ]}
          />
        </Row>
      </Section>

      <Section title={t('sectionOffline')}>
        <Row label={t('downloadOffline')} help={t('downloadHelp')}>
          <button
            type="button"
            onClick={startDownload}
            disabled={download !== null && download.done < download.total}
            className="min-h-9 rounded-lg bg-[var(--color-paper)] px-3 text-sm ring-1 ring-[var(--color-line)] disabled:opacity-60"
          >
            {download === null
              ? t('downloadOffline')
              : download.done >= download.total
                ? t('downloaded')
                : `${t('downloading')} ${String(Math.round((download.done / download.total) * 100))}%`}
          </button>
        </Row>
      </Section>

      <Section title={t('reset')}>
        <Row label={t('reset')} help={t('progressLocal')}>
          <button
            type="button"
            onClick={() => {
              for (const slug of Object.keys(summaries)) resetReading(slug);
            }}
            className="min-h-9 rounded-lg px-3 text-sm text-red-600 ring-1 ring-[var(--color-line)] dark:text-red-400"
          >
            {t('reset')}
          </button>
        </Row>
        <Row label={t('resetAll')}>
          <button
            type="button"
            onClick={resetSettings}
            disabled={JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS)}
            className="min-h-9 rounded-lg px-3 text-sm ring-1 ring-[var(--color-line)] disabled:opacity-50"
          >
            {t('resetAll')}
          </button>
        </Row>
      </Section>
    </Page>
  );
}
