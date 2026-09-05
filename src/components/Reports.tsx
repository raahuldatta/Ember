import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { differenceInMinutes } from 'date-fns';

export default function Reports() {
  const { getToken } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      const res = await fetch('/api/incidents', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setIncidents(await res.json());
    };
    load();
  }, [getToken]);

  const open = incidents.filter((i) => i.status !== 'resolved').length;
  const sev1 = incidents.filter((i) => i.severity === 'sev1' && i.status !== 'resolved').length;
  const resolved = incidents.filter((i) => i.status === 'resolved');
  const mttr =
    resolved.length === 0
      ? null
      : Math.round(
          resolved.reduce((sum, i) => {
            const start = new Date(i.triggeredAt);
            const end = i.resolvedAt ? new Date(i.resolvedAt) : new Date();
            return sum + differenceInMinutes(end, start);
          }, 0) / resolved.length
        );

  return (
    <div className="flex-1 overflow-auto p-6 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Reports</h1>
        <p className="text-sm text-mute mb-8">Workspace snapshot for this session. Demo data resets when the serverless instance recycles.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Open incidents', value: open },
            { label: 'Active SEV-1', value: sev1 },
            { label: 'Resolved', value: resolved.length },
            { label: 'Avg MTTR', value: mttr == null ? '—' : `${mttr}m` },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-line bg-panel p-4">
              <div className="text-xs text-mute uppercase tracking-wider">{card.label}</div>
              <div className="text-3xl font-semibold mt-2">{card.value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-line bg-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-sm font-medium">By severity</div>
          <div className="p-4 space-y-3">
            {['sev1', 'sev2', 'sev3'].map((sev) => {
              const count = incidents.filter((i) => i.severity === sev).length;
              const pct = incidents.length ? (count / incidents.length) * 100 : 0;
              return (
                <div key={sev}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="uppercase font-mono">{sev}</span>
                    <span className="text-mute">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-raised overflow-hidden">
                    <div
                      className={`h-full ${sev === 'sev1' ? 'bg-red-500' : sev === 'sev2' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
