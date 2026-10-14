import { useState } from 'react';
import { usePrefs } from './i18n/PrefsProvider';
import { ROUTE_LABEL, Sidebar, type Route } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { RecipesPage } from './pages/RecipesPage';
import { ItemsPage } from './pages/ItemsPage';
import { QualityPage } from './pages/QualityPage';
import { StockPage } from './pages/StockPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

function initialRoute(): Route {
  const r = new URLSearchParams(location.search).get('route');
  return r && r in ROUTE_LABEL ? (r as Route) : 'dashboard';
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
          {route === 'dashboard' ? (
            <DashboardPage />
          ) : route === 'workOrders' ? (
            <WorkOrdersPage />
          ) : route === 'recipes' ? (
            <RecipesPage />
          ) : route === 'quality' ? (
            <QualityPage />
          ) : route === 'items' ? (
            <ItemsPage />
          ) : route === 'stock' ? (
            <StockPage />
          ) : route === 'settings' ? (
            <SettingsPage />
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
