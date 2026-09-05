import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { AlertTriangle, CheckSquare, Flame, Plus, Search, Square, X } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard({
  onSelectIncident,
  isLivePolling,
  alertsOnly = false,
}: {
  onSelectIncident: (id: number) => void;
  isLivePolling: boolean;
  alertsOnly?: boolean;
}) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>(alertsOnly ? 'triggered' : 'all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterService, setFilterService] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [newIncidentForm, setNewIncidentForm] = useState({ title: '', description: '', severity: 'sev2' });
  const { getToken } = useAuth();

  useEffect(() => {
    setFilterStatus(alertsOnly ? 'triggered' : 'all');
  }, [alertsOnly]);

  const fetchIncidents = async () => {
    const token = await getToken();
    try {
      const res = await fetch('/api/incidents', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setIncidents(await res.json());
        setError(null);
      } else {
        setError('Could not load incidents.');
      }
    } catch (e) {
      console.error(e);
      setError('Could not load incidents.');
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    if (!isLivePolling) return;
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, [isLivePolling]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setCreateModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken();
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(newIncidentForm),
    });
    if (res.ok) {
      setCreateModalOpen(false);
      setNewIncidentForm({ title: '', description: '', severity: 'sev2' });
      fetchIncidents();
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (filterStatus !== 'all' && inc.status !== filterStatus) return false;
      if (filterSeverity !== 'all' && inc.severity !== filterSeverity) return false;
      if (filterService) {
        const query = filterService.toLowerCase();
        const matchesTitle = inc.title?.toLowerCase().includes(query);
        const matchesService = inc.affectedServices?.some((s: string) => s.toLowerCase().includes(query));
        const matchesTag = inc.tags?.some((t: string) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesService && !matchesTag) return false;
      }
      return true;
    });
  }, [incidents, filterStatus, filterSeverity, filterService]);

  const toggleAll = () => {
    if (selectedIds.size === filteredIncidents.length && filteredIncidents.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredIncidents.map((i) => i.id)));
  };

  const handleBulkAction = async (action: string) => {
    const token = await getToken();
    await fetch('/api/incidents/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: Array.from(selectedIds), action }),
    });
    setSelectedIds(new Set());
    fetchIncidents();
  };

  const open = incidents.filter((i) => i.status !== 'resolved').length;
  const sev1 = incidents.filter((i) => i.severity === 'sev1' && i.status !== 'resolved').length;
  const pending = incidents.filter((i) => i.status === 'pending_approval').length;

  const statusLabel: Record<string, string> = {
    triggered: 'Open',
    investigating: 'Investigating',
    pending_approval: 'Needs approval',
    resolved: 'Resolved',
    aborted: 'Aborted',
  };

  return (
    <div className="flex-1 w-full p-4 sm:p-8 space-y-5 overflow-auto">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-mono text-ember uppercase tracking-[0.18em] mb-2">Incident queue</p>
            <h1 className="text-2xl sm:text-3xl font-semibold">{alertsOnly ? 'Active alerts' : 'Incidents'}</h1>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2 bg-ember text-white font-medium rounded-xl hover:bg-ember-hot"
          >
            <Plus className="w-4 h-4" /> New incident
            <span className="hidden sm:inline text-white/70 font-mono text-[10px] ml-1">C</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Open', value: open, accent: 'text-paper' },
            { label: 'SEV-1 live', value: sev1, accent: 'text-red-400' },
            { label: 'Awaiting you', value: pending, accent: 'text-amber-300' },
            { label: 'In view', value: filteredIncidents.length, accent: 'text-ember' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-line bg-panel p-4">
              <div className="text-xs text-mute">{card.label}</div>
              <div className={`text-2xl font-semibold mt-1 ${card.accent}`}>{card.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-mute absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search title, service, or tag  ·  S"
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              className="w-full bg-panel border border-line focus:border-ember rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 bg-panel text-sm border border-line rounded-xl px-3 py-2.5 outline-none"
            >
              <option value="all">All statuses</option>
              <option value="triggered">Open</option>
              <option value="investigating">Investigating</option>
              <option value="pending_approval">Needs approval</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="flex-1 bg-panel text-sm border border-line rounded-xl px-3 py-2.5 outline-none"
            >
              <option value="all">All severities</option>
              <option value="sev1">SEV-1</option>
              <option value="sev2">SEV-2</option>
              <option value="sev3">SEV-3</option>
            </select>
          </div>
        </div>

        {error && <div className="mb-4 text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-3">{error}</div>}

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-ember/10 border border-ember/30 p-3 rounded-xl mb-4">
            <span className="text-sm">{selectedIds.size} selected</span>
            <button onClick={() => handleBulkAction('investigate')} className="text-sm px-3 py-1 rounded-lg bg-raised border border-line">
              Investigate
            </button>
            <button onClick={() => handleBulkAction('resolve')} className="text-sm px-3 py-1 rounded-lg bg-raised border border-line">
              Resolve
            </button>
          </div>
        )}

        <div className="border border-line rounded-2xl bg-panel overflow-hidden">
          <div className="hidden md:flex items-center px-4 py-2 border-b border-line text-[11px] uppercase tracking-wider text-mute">
            <button className="w-8 flex justify-center" onClick={toggleAll} aria-label="Select all">
              {selectedIds.size === filteredIncidents.length && filteredIncidents.length > 0 ? <CheckSquare className="w-4 h-4 text-ember" /> : <Square className="w-4 h-4" />}
            </button>
            <div className="w-24">Key</div>
            <div className="flex-1">Summary</div>
            <div className="w-28">Severity</div>
            <div className="w-36">Status</div>
            <div className="w-28">Opened</div>
          </div>

          {filteredIncidents.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Flame className="w-8 h-8 text-ember mx-auto mb-3" />
              <p className="text-sm text-mute">No incidents match this filter.</p>
            </div>
          ) : (
            filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => onSelectIncident(inc.id)}
                className="flex flex-col md:flex-row md:items-center gap-2 md:gap-0 px-4 py-3 border-b border-line last:border-b-0 hover:bg-raised/70 cursor-pointer"
              >
                <div className="flex items-start gap-3 md:contents">
                  <button className="w-8 flex justify-center pt-1" onClick={(e) => toggleSelect(e, inc.id)} aria-label="Select incident">
                    {selectedIds.has(inc.id) ? <CheckSquare className="w-4 h-4 text-ember" /> : <Square className="w-4 h-4 text-mute" />}
                  </button>
                  <div className="w-24 font-mono text-sm text-ember">INC-{1000 + inc.id}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{inc.title}</div>
                    <div className="text-xs text-mute truncate">{inc.affectedServices?.join(' · ') || 'Unscoped'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:contents pl-11 md:pl-0 text-xs">
                  <div className="md:w-28 uppercase font-mono flex items-center gap-1">
                    {inc.severity === 'sev1' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                    {inc.severity}
                  </div>
                  <div className="md:w-36">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        inc.status === 'resolved'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : inc.status === 'pending_approval'
                            ? 'bg-amber-500/15 text-amber-200'
                            : inc.status === 'triggered'
                              ? 'bg-white/10 text-mute'
                              : 'bg-sky-500/15 text-sky-300'
                      }`}
                    >
                      {statusLabel[inc.status] || inc.status}
                    </span>
                  </div>
                  <div className="md:w-28 text-mute">
                    {inc.triggeredAt ? format(new Date(inc.triggeredAt), 'MMM d, HH:mm') : '—'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-panel border border-line rounded-2xl w-full max-w-lg">
            <div className="flex justify-between items-center p-5 border-b border-line">
              <h2 className="text-lg font-medium">Open an incident</h2>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-raised">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateIncident} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-mute mb-1">Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newIncidentForm.title}
                  onChange={(e) => setNewIncidentForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-ink border border-line focus:border-ember rounded-xl px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-mute mb-1">Context</label>
                <textarea
                  rows={4}
                  value={newIncidentForm.description}
                  onChange={(e) => setNewIncidentForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-ink border border-line focus:border-ember rounded-xl px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-mute mb-1">Severity</label>
                <select
                  value={newIncidentForm.severity}
                  onChange={(e) => setNewIncidentForm((f) => ({ ...f, severity: e.target.value }))}
                  className="w-full bg-ink border border-line rounded-xl px-3 py-2 text-sm outline-none"
                >
                  <option value="sev1">SEV-1 — customer impact now</option>
                  <option value="sev2">SEV-2 — degraded, contained</option>
                  <option value="sev3">SEV-3 — elevated risk</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm text-mute hover:text-paper">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-ember text-white rounded-xl">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
