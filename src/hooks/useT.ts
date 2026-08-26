import { useMemo } from 'react';
import { translator, isRtl, type TranslationKey } from '../i18n.js';
import { useSettings } from '../store/settings.js';

export interface Translation {
  t: (key: TranslationKey) => string;
  lang: 'en' | 'he';
  rtl: boolean;
}

export function useT(): Translation {
  const lang = useSettings((s) => s.settings.uiLang);
  return useMemo(() => ({ t: translator(lang), lang, rtl: isRtl(lang) }), [lang]);
}
