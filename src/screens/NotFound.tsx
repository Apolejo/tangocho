import { TODAY_HREF } from '../app/routes.ts';
import buttons from '../components/Buttons.module.css';
import { useT } from '../i18n/hooks.ts';

export function NotFound() {
  const t = useT();
  return (
    <section style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center' }}>
      <h1 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-lg)' }}>{t('not_found')}</h1>
      <a href={TODAY_HREF} className={buttons.secondary}>
        {t('not_found_link')}
      </a>
    </section>
  );
}
