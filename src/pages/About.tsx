import attributionData from '../data/attribution.json' with { type: 'json' };
import type { Attribution } from '../lib/types.js';
import { useT } from '../hooks/useT.js';
import { AppBar, Page } from '../components/Layout.js';
import { Section } from '../components/Field.js';

const attribution = attributionData as Attribution;

export function About(): React.JSX.Element {
  const { t } = useT();

  return (
    <Page>
      <AppBar title={t('about')} back="/" backLabel={t('back')} />

      <p className="mb-6 text-sm leading-relaxed text-[var(--color-muted)]">
        {t('attributionBody')}
      </p>

      <Section title={t('attribution')}>
        {attribution.editions.map((edition) => (
          <div key={`${edition.role}-${edition.title}`} className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {edition.role}
            </p>
            <p className="mt-0.5 text-sm">{edition.title}</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{edition.license}</p>
          </div>
        ))}
      </Section>

      <p className="mb-6 text-sm text-[var(--color-muted)]">{t('progressLocal')}</p>

      <a
        href="https://www.sefaria.org"
        target="_blank"
        rel="noreferrer noopener"
        className="text-sm text-[var(--color-accent)] underline"
      >
        {t('sourceLink')}
      </a>
    </Page>
  );
}
