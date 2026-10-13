import { usePrefs } from '../i18n/PrefsProvider';
import type { MessageKey } from '../i18n';

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export function StatusChip({ label, tone }: { label: MessageKey; tone: Tone }) {
  const { t } = usePrefs();
  return (
    <span className="chip" data-tone={tone}>
      {t(label)}
    </span>
  );
}

/** Lot/batch codes are LTR, monospaced, and bidi-isolated so they never mirror. */
export function LotBadge({ code }: { code: string }) {
  return (
    <bdi className="lot-badge ltr-code" dir="ltr">
      {code}
    </bdi>
  );
}
