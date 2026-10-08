import { useLang, useT } from '../i18n/hooks.ts';
import { LANGS } from '../i18n/lang.ts';
import styles from './LangToggle.module.css';

const SHORT = { en: 'EN', es: 'ES' } as const;

export function LangToggle() {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <div className={styles.toggle} role="group" aria-label={t('language_label')}>
      {LANGS.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          className={styles.button}
          aria-pressed={lang === option}
          aria-label={t(option === 'en' ? 'lang_en' : 'lang_es')}
          onClick={() => setLang(option)}
        >
          {SHORT[option]}
        </button>
      ))}
    </div>
  );
}
