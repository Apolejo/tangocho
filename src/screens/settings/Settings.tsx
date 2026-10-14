import { useEffect, useId, useRef, useState } from 'react';
import { APP_COMMIT, APP_VERSION } from '../../app/build.ts';
import { COFFEE_URL, SOURCE_URL } from '../../app/links.ts';
import { THEMES, setTheme, type Theme } from '../../app/theme.ts';
import { usePwa } from '../../app/pwa.ts';
import { useTheme } from '../../app/useTheme.ts';
import buttons from '../../components/Buttons.module.css';
import pills from '../../components/Pills.module.css';
import { GAMES } from '../../games/registry.ts';
import type { MessageKey } from '../../i18n/en.ts';
import { useLang, useT } from '../../i18n/hooks.ts';
import { LANGS } from '../../i18n/lang.ts';
import { setFuriganaEverywhere } from '../../play/setup.ts';
import { dayKey } from '../../progress/day.ts';
import { deviceId } from '../../progress/device.ts';
import { exportReminder, goalOn, setGoal } from '../../progress/goal.ts';
import { persistStatus, type PersistStatus } from '../../progress/persist.ts';
import { GOAL_OPTIONS, NEW_PER_DAY_OPTIONS, updateSettings } from '../../progress/settings.ts';
import { progress } from '../../progress/store.ts';
import { importProgressFile } from '../../progress/transfer.ts';
import { useNow } from '../../progress/useNow.ts';
import { useProgress } from '../../progress/useProgress.ts';
import { useSettings } from '../../progress/useSettings.ts';
import styles from './Settings.module.css';
import { exportProgress } from './share.ts';

const THEME_KEYS: Record<Theme, MessageKey> = {
  system: 'theme_system',
  light: 'theme_light',
  dark: 'theme_dark',
};

const STORAGE_KEYS: Record<PersistStatus, MessageKey> = {
  persisted: 'storage_persisted',
  'not-persisted': 'storage_not_persisted',
  unsupported: 'storage_unsupported',
};

type Message = { key: MessageKey; vars?: Record<string, string | number> };
type ResetStep = 'idle' | 'confirm' | 'final';

/** One group of radio pills. */
function Choice<T extends string | number | boolean>({
  name,
  legend,
  note,
  options,
  value,
  label,
  onChange,
}: {
  name: string;
  legend: string;
  note?: string;
  options: readonly T[];
  value: T;
  label(option: T): string;
  onChange(option: T): void;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={pills.pills}>
        {options.map((option) => (
          <label key={String(option)} className={pills.pill}>
            <input
              type="radio"
              className={pills.radio}
              name={name}
              checked={option === value}
              onChange={() => onChange(option)}
            />
            {label(option)}
          </label>
        ))}
      </div>
      {note !== undefined && <p className={styles.note}>{note}</p>}
    </fieldset>
  );
}

/**
 * Settings (SPEC §7.7): language, theme, the furigana default, the daily goal, new cards per day,
 * export and import of progress, storage, offline use, and reset progress after two confirmations;
 * then About: the version, the privacy note, the open word reports count, the coffee and the source.
 */
export function Settings() {
  const t = useT();
  const { lang, setLang } = useLang();
  const now = useNow();
  const settings = useSettings();
  const theme = useTheme();
  const { offlineReady } = usePwa();
  const { events } = useProgress();
  const today = dayKey(now);
  const [message, setMessage] = useState<Message>();
  // counts the messages, so a test can tell a new one from the same text again
  const [messages, setMessages] = useState(0);
  const say = (next: Message) => {
    setMessage(next);
    setMessages((n) => n + 1);
  };
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState<ResetStep>('idle');
  const [storage, setStorage] = useState<PersistStatus>();

  // Each confirmation step moves the focus to Cancel, so Enter pressed again never confirms the
  // next step; back to idle, the focus returns to Reset.
  const resetRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resetShown = useRef<ResetStep>(reset);
  useEffect(() => {
    if (resetShown.current === reset) return;
    resetShown.current = reset;
    (reset === 'idle' ? resetRef : cancelRef).current?.focus();
  }, [reset]);
  const warningId = useId();

  useEffect(() => {
    let alive = true;
    void persistStatus().then((status) => {
      if (alive) setStorage(status);
    });
    return () => {
      alive = false;
    };
  }, [events.length]);

  const onExport = async () => {
    const at = new Date();
    try {
      const outcome = await exportProgress(events, deviceId(), at);
      if (outcome === 'cancelled') return;
      updateSettings((s) => ({ ...s, lastExportAt: at.toISOString() }));
      say({ key: 'settings_exported' });
    } catch (error: unknown) {
      console.warn('could not export', error);
      say({ key: 'settings_export_failed' });
    }
  };

  const onImport = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;
    setBusy(true);
    try {
      const outcome = await importProgressFile(await file.text(), progress);
      say(
        outcome.ok
          ? {
              key: 'import_result',
              vars: { added: outcome.added, existing: outcome.existing, skipped: outcome.skipped },
            }
          : { key: outcome.reason === 'newer-version' ? 'import_newer' : 'import_not_tangocho' },
      );
    } catch (error: unknown) {
      console.warn('could not import', error);
      say({ key: 'import_failed' });
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    setBusy(true);
    try {
      await progress.reset();
      say({ key: 'reset_done' });
    } finally {
      setBusy(false);
      setReset('idle');
    }
  };

  const dateTime = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
  const remind = exportReminder({
    lastExportAt: settings.lastExportAt,
    firstEventAt: events[0]?.at,
    lastEventAt: events.at(-1)?.at,
    now,
  });

  return (
    <section className={styles.settings} aria-labelledby="settings-title">
      <h1 id="settings-title" className={styles.title}>
        {t('settings_title')}{' '}
        <span lang="ja" className={styles.titleJa}>
          設定
        </span>
      </h1>

      <div className={styles.sheet}>
        <Choice
          name="language"
          legend={t('language_label')}
          options={LANGS}
          value={lang}
          label={(option) => t(option === 'en' ? 'lang_en' : 'lang_es')}
          onChange={setLang}
        />
        <Choice
          name="theme"
          legend={t('settings_theme')}
          note={t('settings_theme_note')}
          options={THEMES}
          value={theme}
          label={(option) => t(THEME_KEYS[option])}
          onChange={setTheme}
        />
        <Choice
          name="furigana"
          legend={t('settings_furigana')}
          note={t('settings_furigana_note')}
          options={[true, false]}
          value={settings.furigana}
          label={(on) => t(on ? 'setup_on' : 'setup_off')}
          onChange={(furigana) => {
            updateSettings((s) => ({ ...s, furigana }));
            setFuriganaEverywhere(
              GAMES.map((g) => g.id),
              furigana,
            );
          }}
        />
        <Choice
          name="goal"
          legend={t('settings_goal')}
          note={t('settings_goal_note')}
          options={GOAL_OPTIONS}
          value={goalOn(settings.goals, today)}
          label={(n) => t('settings_goal_option', { n })}
          onChange={(goal) =>
            updateSettings((s) => ({ ...s, goals: setGoal(s.goals, today, goal) }))
          }
        />
        <Choice
          name="new-per-day"
          legend={t('settings_new')}
          note={t('settings_new_note')}
          options={NEW_PER_DAY_OPTIONS}
          value={settings.newPerDay}
          label={(n) => String(n)}
          onChange={(newPerDay) => updateSettings((s) => ({ ...s, newPerDay }))}
        />
      </div>

      <h2 className={styles.subtitle}>{t('settings_progress')}</h2>
      <div className={styles.sheet}>
        <div className={styles.group}>
          <p className={styles.note}>{t('settings_transfer_note')}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={buttons.primary}
              onClick={() => void onExport()}
              disabled={busy}
            >
              {t('settings_export')}
            </button>
            <label className={`${buttons.secondary} ${styles.file}`}>
              {t('settings_import')}
              <input
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                disabled={busy}
                onChange={(e) => void onImport(e.currentTarget)}
                data-import
              />
            </label>
          </div>
          <p className={styles.status} role="status" data-transfer-status={messages}>
            {message !== undefined && t(message.key, message.vars)}
          </p>
          <p className={styles.line} data-last-export>
            {settings.lastExportAt === undefined
              ? t('settings_never_exported')
              : t('settings_last_export', {
                  date: dateTime.format(new Date(settings.lastExportAt)),
                })}
          </p>
          {remind && <p className={styles.remind}>{t('settings_export_due')}</p>}
        </div>
        {storage !== undefined && (
          <div className={styles.group}>
            <p className={styles.legend}>{t('settings_storage')}</p>
            <p className={styles.note} data-storage={storage}>
              {t(STORAGE_KEYS[storage])}
            </p>
          </div>
        )}
        <div className={styles.group}>
          <p className={styles.legend}>{t('settings_offline')}</p>
          <p className={styles.note} data-offline={offlineReady ? 'ready' : 'pending'}>
            {t(offlineReady ? 'offline_ready' : 'offline_pending')}
          </p>
        </div>
        <div className={styles.group}>
          <p className={styles.legend}>{t('settings_reset')}</p>
          <p className={styles.note}>{t('reset_note')}</p>
          {reset === 'idle' ? (
            <div className={styles.actions}>
              <button
                ref={resetRef}
                type="button"
                className={buttons.danger}
                onClick={() => setReset('confirm')}
                disabled={busy}
              >
                {t('settings_reset')}
              </button>
            </div>
          ) : (
            <div key={reset} className={styles.confirm} role="group" aria-labelledby={warningId}>
              <p id={warningId} className={styles.warning}>
                {t(reset === 'confirm' ? 'reset_confirm_1' : 'reset_confirm_2')}
              </p>
              <div className={styles.actions}>
                {reset === 'confirm' ? (
                  <button
                    type="button"
                    className={buttons.danger}
                    onClick={() => setReset('final')}
                  >
                    {t('reset_yes')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={buttons.danger}
                    onClick={() => void onReset()}
                    disabled={busy}
                  >
                    {t('reset_final')}
                  </button>
                )}
                <button
                  ref={cancelRef}
                  type="button"
                  className={buttons.secondary}
                  onClick={() => setReset('idle')}
                >
                  {t('reset_cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <h2 className={styles.subtitle}>{t('settings_about')}</h2>
      <div className={styles.sheet}>
        <div className={styles.group}>
          <p className={styles.legend}>
            <span lang="ja">単語帳</span> {t('appName')}
          </p>
          <p className={styles.line} data-version>
            {t('about_version', { version: `${APP_VERSION} · ${APP_COMMIT}` })}
          </p>
          <p className={styles.note}>{t('about_privacy')}</p>
        </div>
        <Choice
          name="reports-banner"
          legend={t('settings_reports')}
          note={t('settings_reports_note')}
          options={[true, false]}
          value={settings.reportsBanner}
          label={(on) => t(on ? 'setup_on' : 'setup_off')}
          onChange={(reportsBanner) => updateSettings((s) => ({ ...s, reportsBanner }))}
        />
        <div className={styles.group}>
          <p className={styles.note}>{t('about_thanks')}</p>
          <div className={styles.actions}>
            <a
              href={COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttons.secondary}
            >
              {/* a cup drawn in ink, like the ⚑: the ☕ emoji would come in the system's colors */}
              <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
                <path d="M8 3.5c-1 1 1 2 0 3.5M12 3.5c-1 1 1 2 0 3.5" />
                <path d="M4 10h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
                <path d="M16 11.5h1.5a2.5 2.5 0 0 1 0 5H16M3 21.5h16" />
              </svg>
              {t('about_coffee')}
            </a>
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttons.secondary}
            >
              {t('about_source')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
