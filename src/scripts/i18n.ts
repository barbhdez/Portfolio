import strings from '../data/translations.json';

export type Lang = 'en' | 'es' | 'fr';
export type Localized = Record<Lang, string>;
type Strings = Record<string, string> & { places: Record<string, string> };

const LANGS: Lang[] = ['en', 'es', 'fr'];
const table = strings as unknown as Record<Lang, Strings>;
const listeners: (() => void)[] = [];

function initial(): Lang {
  try {
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved && LANGS.includes(saved)) return saved;
  } catch (e) {}
  const nav = (navigator.language || 'en').slice(0, 2) as Lang;
  return LANGS.includes(nav) ? nav : 'en';
}

let lang: Lang = initial();

export const t = (key: string) => table[lang][key] ?? table.en[key] ?? key;
export const place = (name: string) => table[lang].places[name] ?? name;
export const pick = (text: Localized | string) => (typeof text === 'string' ? text : text[lang] ?? text.en);
export const onLangChange = (fn: () => void) => listeners.push(fn);

function apply() {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n!)));
  document.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nLabel!)));
  document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((b) => {
    const on = b.dataset.lang === lang;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem('lang', lang); } catch (e) {}
  apply();
  listeners.forEach((fn) => fn());
}

export function initLang() {
  apply();
  document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((b) =>
    b.addEventListener('click', () => setLang(b.dataset.lang as Lang)));
}
