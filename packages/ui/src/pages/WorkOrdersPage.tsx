import { useState } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import type { MessageKey } from '../i18n';
import { LotBadge, StatusChip, type Tone } from '../components/Badges';
import { ChevronBack, ChevronForward } from '../components/icons';

/** DEMO DATA ONLY (M0 shell). Quantities are fixed-scale strings, money is integer halalas. */
interface DemoRow {
  number: string;
  item: MessageKey;
  lot: string;
  qty: string;
  unit: MessageKey;
  costMinor: number;
  due: string;
  status: { label: MessageKey; tone: Tone };
  qc: { label: MessageKey; tone: Tone };
  progress: number;
}

const ROWS: DemoRow[] = [
  { number: 'WO-2026-00041', item: 'item.tomatoSauce', lot: 'LT-260412-A', qty: '1250.500', unit: 'unit.kg', costMinor: 1875075, due: '2026-10-15T09:00:00Z', status: { label: 'status.inProgress', tone: 'warning' }, qc: { label: 'qc.quarantine', tone: 'warning' }, progress: 60 },
  { number: 'WO-2026-00040', item: 'item.handCream', lot: 'LT-260410-C', qty: '4800', unit: 'unit.pcs', costMinor: 2304000, due: '2026-10-14T09:00:00Z', status: { label: 'status.completed', tone: 'success' }, qc: { label: 'qc.released', tone: 'success' }, progress: 100 },
  { number: 'WO-2026-00039', item: 'item.labneh', lot: 'LT-260409-B', qty: '320.000', unit: 'unit.kg', costMinor: 512000, due: '2026-10-13T09:00:00Z', status: { label: 'status.completed', tone: 'success' }, qc: { label: 'qc.rejected', tone: 'danger' }, progress: 100 },
  { number: 'WO-2026-00042', item: 'item.detergent', lot: 'LT-260413-A', qty: '900.000', unit: 'unit.l', costMinor: 405000, due: '2026-10-18T09:00:00Z', status: { label: 'status.released', tone: 'info' }, qc: { label: 'qc.quarantine', tone: 'warning' }, progress: 0 },
  { number: 'WO-2026-00043', item: 'item.dough', lot: 'LT-260414-D', qty: '2000', unit: 'unit.pcs', costMinor: 360050, due: '2026-10-20T09:00:00Z', status: { label: 'status.draft', tone: 'neutral' }, qc: { label: 'qc.quarantine', tone: 'warning' }, progress: 0 },
];

const STEPS: MessageKey[] = ['status.draft', 'status.released', 'status.inProgress', 'status.completed'];

export function WorkOrdersPage() {
  const { t, money, num, date } = usePrefs();
  const [q, setQ] = useState('');
  const rows = ROWS.filter((r) => !q || r.number.toLowerCase().includes(q.toLowerCase()) || t(r.item).includes(q));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('page.workOrders.title')}</h1>
          <p className="page-sub">{t('page.workOrders.subtitle')}</p>
        </div>
      </div>
      <section className="card">
        <ol className="stepper" aria-label={t('stepper.label')}>
          {STEPS.map((s, i) => (
            <li key={s} className="step" data-state={i < 2 ? 'done' : i === 2 ? 'current' : 'todo'}>
              {i > 0 && <span className="step-bar" aria-hidden />}
              <span className="step-dot num">{num(i + 1)}</span>
              <span>{t(s)}</span>
            </li>
          ))}
        </ol>
        <div className="toolbar">
          <input
            className="input"
            type="search"
            aria-label={t('page.workOrders.search')}
            placeholder={t('page.workOrders.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('col.number')}</th>
                <th scope="col">{t('col.item')}</th>
                <th scope="col">{t('col.lot')}</th>
                <th scope="col" className="col-num">{t('col.qty')}</th>
                <th scope="col" className="col-num">{t('col.cost')}</th>
                <th scope="col">{t('col.due')}</th>
                <th scope="col">{t('col.status')}</th>
                <th scope="col">{t('col.qc')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const [, frac = ''] = r.qty.split('.');
                return (
                  <tr key={r.number}>
                    <td>
                      <bdi className="ltr-code" dir="ltr">{r.number}</bdi>
                    </td>
                    <td>{t(r.item)}</td>
                    <td>
                      <LotBadge code={r.lot} />
                    </td>
                    <td className="col-num num">
                      {num(r.qty, frac.length)} {t(r.unit)}
                    </td>
                    <td className="col-num num">{money(r.costMinor)}</td>
                    <td className="num">{date(r.due)}</td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        <StatusChip {...r.status} />
                        <span className="progress" role="progressbar" aria-valuenow={r.progress} aria-valuemin={0} aria-valuemax={100}>
                          <span style={{ inlineSize: `${r.progress}%` }} />
                        </span>
                      </span>
                    </td>
                    <td>
                      <StatusChip {...r.qc} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <button type="button" className="btn">
            <ChevronBack />
            {t('page.prev')}
          </button>
          <button type="button" className="btn">
            {t('page.next')}
            <ChevronForward />
          </button>
        </div>
      </section>
    </>
  );
}
