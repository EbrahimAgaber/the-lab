import type { ReactElement } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import type { MessageKey } from '../i18n';
import { IconBox, IconFactory, IconFlask, IconGauge, IconLayers, IconSettings } from './icons';

export type Route = 'dashboard' | 'workOrders' | 'quality' | 'items' | 'stock' | 'settings';

interface NavItem {
  route: Route;
  label: MessageKey;
  Icon: () => ReactElement;
}

const SECTIONS: { label: MessageKey; items: NavItem[] }[] = [
  {
    label: 'nav.section.operations',
    items: [
      { route: 'dashboard', label: 'nav.dashboard', Icon: IconGauge },
      { route: 'workOrders', label: 'nav.workOrders', Icon: IconFactory },
      { route: 'quality', label: 'nav.quality', Icon: IconFlask },
    ],
  },
  {
    label: 'nav.section.inventory',
    items: [
      { route: 'items', label: 'nav.items', Icon: IconBox },
      { route: 'stock', label: 'nav.stock', Icon: IconLayers },
    ],
  },
  {
    label: 'nav.section.system',
    items: [{ route: 'settings', label: 'nav.settings', Icon: IconSettings }],
  },
];

export const ROUTE_LABEL: Record<Route, MessageKey> = Object.fromEntries(
  SECTIONS.flatMap((s) => s.items.map((i) => [i.route, i.label])),
) as Record<Route, MessageKey>;

export function Sidebar({
  route,
  onNavigate,
  collapsed,
}: {
  route: Route;
  onNavigate: (r: Route) => void;
  collapsed: boolean;
}) {
  const { t } = usePrefs();
  return (
    <nav className="sidebar" aria-label={t('nav.label')} data-collapsed={collapsed}>
      <div className="brand">
        <div className="brand-mark">
          <IconFlask />
        </div>
        <div>
          <div className="brand-name">{t('app.name')}</div>
          <div className="brand-tag">{t('app.tagline')}</div>
        </div>
      </div>
      {SECTIONS.map((s) => (
        <div key={s.label} role="group" aria-label={t(s.label)}>
          <div className="nav-section">{t(s.label)}</div>
          {s.items.map(({ route: r, label, Icon }) => (
            <button
              key={r}
              type="button"
              className="nav-link"
              aria-current={r === route ? 'page' : undefined}
              onClick={() => onNavigate(r)}
            >
              <Icon />
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
