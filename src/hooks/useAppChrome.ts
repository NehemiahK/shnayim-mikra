import { useEffect } from 'react';
import { useSettings } from '../store/settings.js';
import { isRtl } from '../i18n.js';

/**
 * Applies the settings that live on <html>: colour theme, text direction,
 * language, and the reading text scale. Kept in one effect so the document and
 * the store can never disagree.
 */
export function useAppChrome(): void {
  const { theme, uiLang, fontScale } = useSettings((s) => s.settings);

  useEffect(() => {
    const root = document.documentElement;

    const apply = (): void => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset['theme'] = dark ? 'dark' : 'light';
      root
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#14120f' : '#faf8f4');
    };

    apply();
    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => { media.removeEventListener('change', apply); };
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = uiLang;
    root.dir = isRtl(uiLang) ? 'rtl' : 'ltr';
  }, [uiLang]);

  useEffect(() => {
    document.documentElement.style.setProperty('--reading-scale', String(fontScale));
  }, [fontScale]);
}
