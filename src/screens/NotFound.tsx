import { useT } from '../i18n/hooks.ts';

export function NotFound() {
  const t = useT();
  return (
    <section style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center' }}>
      <p>{t('not_found')}</p>
      <a href="#/notebook">{t('not_found_link')}</a>
    </section>
  );
}
