import { useState } from 'react';
import { usePrefs } from './i18n/PrefsProvider';
import { ROUTE_LABEL, Sidebar, type Route } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WorkOrdersPage } from './pages/WorkOrdersPage';

function initialRoute(): Route {
  const r = new URLSearchParams(location.search).get('route');
  return r && r in ROUTE_LABEL ? (r as Route) : 'workOrders';
}

export function App() {
  const { t } = usePrefs();
  const [route, setRoute] = useState<Route>(initialRoute);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="shell">
      <Sidebar route={route} onNavigate={setRoute} collapsed={collapsed} />
      <div className="main">
        <TopBar current={ROUTE_LABEL[route]} onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="content">
          {route === 'workOrders' ? (
            <WorkOrdersPage />
          ) : (
            <div className="card placeholder">
              <h1 className="page-title">{t(ROUTE_LABEL[route])}</h1>
              <p>{t('dashboard.placeholder')}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
