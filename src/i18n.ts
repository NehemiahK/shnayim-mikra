import type { UiLang } from './store/settings.js';

/**
 * A hand-rolled dictionary rather than an i18n library: two languages, no
 * pluralization rules worth the kilobytes. The `Dict` type forces both
 * languages to stay in sync — a missing key is a type error, and a test
 * asserts key parity as a second guard.
 */
const en = {
  appName: 'Shnayim Mikra',
  tagline: 'Twice in Hebrew, once in Targum',

  thisShabbat: 'This Shabbat',
  upcoming: 'Upcoming',
  continueReading: 'Continue reading',
  startReading: 'Start reading',
  allParshiyot: 'All parshiyot',
  combined: 'combined',
  browse: 'Browse',
  done: 'Done',
  complete: 'Complete',

  aliyah: 'Aliyah',
  aliyot: 'Aliyot',
  verse: 'Verse',
  verses: 'verses',
  mikra: 'Mikra',
  targum: 'Targum',
  onkelos: 'Onkelos',
  rashi: 'Rashi',
  translation: 'Translation',
  english: 'English',
  onkelosEnglish: 'Targum in English',
  onkelosEnglishHelp: 'Start each Targum with its translation already open. Bold marks where Onkelos departs from the literal Hebrew.',
  rashiEnglish: 'Rashi in English',
  rashiEnglishHelp: 'Start each Rashi with its translation already open. You can always expand one by tapping English.',
  firstReading: 'first reading',
  secondReading: 'second reading',
  markVerseDone: 'Mark verse read',
  keyboardHint: 'Press Space to check off each reading as you go',
  noRashi: 'No Rashi on this verse.',
  noRashiUsingTargum: 'No Rashi here — Targum instead:',
  rashiFallback: 'Show Targum when Rashi is missing',
  rashiFallbackHelp: 'Every verse needs its Targum reading. When a pasuk has no Rashi, read Onkelos there instead of having nothing to read.',
  showMore: 'Show Rashi and translation',
  showLess: 'Hide',

  settings: 'Settings',
  about: 'About',
  back: 'Back',
  close: 'Close',

  sectionReading: 'Reading',
  sectionText: 'Text',
  sectionBehaviour: 'Behaviour',
  sectionOffline: 'Offline',

  structure: 'Read by',
  structureVerse: 'Verse by verse',
  structureAliyah: 'Whole aliyah',
  structureHelp: 'Verse by verse follows each pasuk through all its readings. Whole aliyah reads the entire aliyah through, then repeats.',

  targumSource: 'Third reading',
  targumHelp: 'Onkelos is the standard practice. The Rema permits Rashi in its place, and some are careful to read both.',
  targumBoth: 'Onkelos and Rashi',
  doubleParsha: 'Double parshiyot',
  doubleParshaCombined: 'As read',
  doubleParshaSeparate: 'Separate',
  doubleParshaHelp: 'Some weeks read two parshiyot together. As read divides them into the seven aliyot of the combined reading; Separate keeps each parsha\u2019s own seven.',
  /** Short label for the compact quick-switch on the reading page itself. */
  both: 'Both',

  repetitions: 'Hebrew readings',
  repetitionsHelp: 'Two by custom. Change only if you have a reason to.',

  hebrewStyle: 'Hebrew text',
  styleTaamim: 'With cantillation',
  styleNikud: 'Vowels only',
  stylePlain: 'Letters only',

  fontSize: 'Text size',
  translationPlacement: 'English translation',
  translationOff: 'Off',
  translationAfter: 'After the Hebrew',
  translationEnd: 'At the end',
  translationPlacementHelp: 'Where the English sits while you read. After the Hebrew puts it before the Targum, so you can see what the pasuk means before reading it again. It is always available by expanding a verse.',
  parallel: 'Side by side',
  parallelHelp: 'On wider screens, place the Targum beside the Hebrew.',

  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',

  region: 'Reading schedule',
  regionDiaspora: 'Diaspora',
  regionIsrael: 'Israel',
  regionHelp: 'The two schedules differ for part of the year after Pesach.',

  language: 'Language',
  reset: 'Reset progress',
  resetAll: 'Reset all settings',
  resetConfirm: 'Reset your progress for this parsha?',

  downloadOffline: 'Download all for offline',
  downloading: 'Downloading',
  downloaded: 'Available offline',
  downloadHelp: 'Saves all 54 parshiyot to this device so the app works with no signal.',

  loading: 'Loading',
  loadFailed: 'Could not load this parsha.',
  retry: 'Retry',
  notFound: 'That parsha does not exist.',
  goHome: 'Go to the start',

  simchatTorah: 'Read on Simchat Torah',
  attribution: 'Texts',
  attributionBody:
    'All texts come from Sefaria. Every edition used here is in the public domain.',
  sourceLink: 'Sefaria',
  progressLocal: 'Your progress is saved on this device only. Nothing is sent anywhere.',
} as const;

export type TranslationKey = keyof typeof en;
type Dict = Record<TranslationKey, string>;

const he: Dict = {
  appName: 'שנים מקרא',
  tagline: 'שנים מקרא ואחד תרגום',

  thisShabbat: 'השבת',
  upcoming: 'הבאות',
  continueReading: 'המשך קריאה',
  startReading: 'התחל קריאה',
  allParshiyot: 'כל הפרשיות',
  combined: 'משולבת',
  browse: 'עיון',
  done: 'הושלם',
  complete: 'הושלמה',

  aliyah: 'עלייה',
  aliyot: 'עליות',
  verse: 'פסוק',
  verses: 'פסוקים',
  mikra: 'מקרא',
  targum: 'תרגום',
  onkelos: 'אונקלוס',
  rashi: 'רש״י',
  translation: 'תרגום לאנגלית',
  english: 'אנגלית',
  onkelosEnglish: 'תרגום באנגלית',
  onkelosEnglishHelp: 'פתח כל תרגום עם תרגומו לאנגלית. הדגשה מציינת היכן אונקלוס חורג מהתרגום המילולי.',
  rashiEnglish: 'רש״י באנגלית',
  rashiEnglishHelp: 'פתח כל רש״י עם תרגומו. תמיד אפשר להרחיב בלחיצה על ״אנגלית״.',
  firstReading: 'ראשונה',
  secondReading: 'שנייה',
  markVerseDone: 'סמן פסוק כנקרא',
  keyboardHint: 'לחיצה על Space מסמנת כל קריאה בתורה',
  noRashi: 'אין רש״י על פסוק זה.',
  noRashiUsingTargum: 'אין כאן רש״י — במקום זאת תרגום:',
  rashiFallback: 'הצג תרגום כשאין רש״י',
  rashiFallbackHelp: 'לכל פסוק יש חובת תרגום. כשאין רש״י על פסוק, קרא אונקלוס במקומו ולא תישאר בלי מה לקרוא.',
  showMore: 'הצג רש״י ותרגום',
  showLess: 'הסתר',

  settings: 'הגדרות',
  about: 'אודות',
  back: 'חזרה',
  close: 'סגור',

  sectionReading: 'קריאה',
  sectionText: 'טקסט',
  sectionBehaviour: 'התנהגות',
  sectionOffline: 'לא מקוון',

  structure: 'סדר הקריאה',
  structureVerse: 'פסוק אחר פסוק',
  structureAliyah: 'עלייה שלמה',
  structureHelp: 'פסוק אחר פסוק — כל פסוק בכל קריאותיו. עלייה שלמה — קריאת כל העלייה ואז חזרה.',

  targumSource: 'הקריאה השלישית',
  targumHelp: 'אונקלוס הוא המנהג הרווח. הרמ״א מתיר רש״י במקומו, ויש המדקדקים לקרוא את שניהם.',
  targumBoth: 'אונקלוס ורש״י',
  doubleParsha: 'פרשיות מחוברות',
  doubleParshaCombined: 'כפי שנקראת',
  doubleParshaSeparate: 'בנפרד',
  doubleParshaHelp: 'יש שבתות שבהן קוראים שתי פרשיות יחד. ״כפי שנקראת״ מחלק לשבע העליות של הקריאה המחוברת; ״בנפרד״ שומר על שבע העליות של כל פרשה.',
  both: 'שניהם',

  repetitions: 'מספר קריאות המקרא',
  repetitionsHelp: 'שתיים כמנהג. שנה רק אם יש לך סיבה.',

  hebrewStyle: 'טקסט עברי',
  styleTaamim: 'עם טעמים',
  styleNikud: 'ניקוד בלבד',
  stylePlain: 'אותיות בלבד',

  fontSize: 'גודל טקסט',
  translationPlacement: 'תרגום לאנגלית',
  translationOff: 'כבוי',
  translationAfter: 'אחרי העברית',
  translationEnd: 'בסוף',
  translationPlacementHelp: 'היכן האנגלית מופיעה בזמן הקריאה. ״אחרי העברית״ ממקמת אותה לפני התרגום, כדי להבין את הפסוק לפני הקריאה החוזרת. תמיד זמינה בהרחבת הפסוק.',
  parallel: 'זה לצד זה',
  parallelHelp: 'במסכים רחבים, הצג את התרגום לצד המקרא.',

  theme: 'ערכת נושא',
  themeLight: 'בהיר',
  themeDark: 'כהה',
  themeSystem: 'לפי המערכת',

  region: 'לוח הקריאה',
  regionDiaspora: 'חוץ לארץ',
  regionIsrael: 'ארץ ישראל',
  regionHelp: 'הלוחות נבדלים בחלק מהשנה לאחר פסח.',

  language: 'שפה',
  reset: 'איפוס התקדמות',
  resetAll: 'איפוס כל ההגדרות',
  resetConfirm: 'לאפס את ההתקדמות בפרשה זו?',

  downloadOffline: 'הורד הכל לשימוש לא מקוון',
  downloading: 'מוריד',
  downloaded: 'זמין לא מקוון',
  downloadHelp: 'שומר את כל 54 הפרשיות במכשיר זה כדי שהאפליקציה תעבוד גם ללא רשת.',

  loading: 'טוען',
  loadFailed: 'לא ניתן לטעון את הפרשה.',
  retry: 'נסה שוב',
  notFound: 'פרשה זו אינה קיימת.',
  goHome: 'לדף הראשי',

  simchatTorah: 'נקראת בשמחת תורה',
  attribution: 'מקורות',
  attributionBody: 'כל הטקסטים מספריא. כל המהדורות כאן הן נחלת הכלל.',
  sourceLink: 'ספריא',
  progressLocal: 'ההתקדמות נשמרת במכשיר זה בלבד. שום מידע אינו נשלח לשום מקום.',
};

export const DICTIONARIES: Record<UiLang, Dict> = { en, he };

export function translator(lang: UiLang) {
  const dict = DICTIONARIES[lang];
  return (key: TranslationKey): string => dict[key];
}

export function isRtl(lang: UiLang): boolean {
  return lang === 'he';
}
