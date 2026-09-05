import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BrainCircuit, Download, FileText, Wand2, X } from 'lucide-react';
import { differenceInMinutes, format } from 'date-fns';
import { useAuth } from './AuthProvider';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function IncidentDetails({ id, onBack }: { id: number; onBack: () => void }) {
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [creatingJira, setCreatingJira] = useState(false);
  const [jiraMessage, setJiraMessage] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [investigating, setInvestigating] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [viewers, setViewers] = useState<any[]>([]);
  const { getToken, user: currentUser } = useAuth();

  const fetchDetails = async () => {
    const token = await getToken();
    try {
      const res = await fetch(`/api/incidents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setIncident(await res.json());
      else setIncident(null);
      const usersRes = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDetails();
  }, [id]);

  useEffect(() => {
    let mounted = true;
    const pingView = async () => {
      const token = await getToken();
      try {
        const res = await fetch(`/api/incidents/${id}/view`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && mounted) setViewers(await res.json());
      } catch (e) {
        console.error('Failed to ping view', e);
      }
    };
    pingView();
    const intervalId = setInterval(pingView, 5000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [id]);

  const handleInvestigate = async () => {
    setInvestigating(true);
    const token = await getToken();
    await fetch(`/api/incidents/${id}/investigate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setInvestigating(false);
    fetchDetails();
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    const token = await getToken();
    const res = await fetch(`/api/incidents/${id}/summarize`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setAiSummary(data.summary);
    }
    setSummarizing(false);
  };

  const handleCreateJira = async () => {
    setCreatingJira(true);
    setJiraMessage('');
    const token = await getToken();
    const res = await fetch(`/api/incidents/${id}/jira`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setCreatingJira(false);
    setJiraMessage(data.jiraKey ? `Created ${data.jiraKey}` : data.message || 'Jira sync finished.');
    fetchDetails();
  };

  const handleAction = async (actionId: number, action: 'approve' | 'reject') => {
    const token = await getToken();
    await fetch(`/api/incidents/${id}/actions/${actionId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    fetchDetails();
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    const currentTags = incident.tags || [];
    if (currentTags.includes(newTag.trim())) return;
    const token = await getToken();
    await fetch(`/api/incidents/${id}/tags`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: [...currentTags, newTag.trim()] }),
    });
    setNewTag('');
    setIsAddingTag(false);
    fetchDetails();
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const token = await getToken();
    await fetch(`/api/incidents/${id}/tags`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: (incident.tags || []).filter((t: string) => t !== tagToRemove) }),
    });
    fetchDetails();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('pdf-content');
    if (!element) return;
    setActiveTab('timeline');
    setTimeout(async () => {
      const canvas = await html2canvas(element, { backgroundColor: '#0b0c10', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, pdf.internal.pageSize.getHeight()));
      pdf.save(`Incident_INC-${1000 + id}_Report.pdf`);
    }, 400);
  };

  const handleAssign = async (assigneeId: string) => {
    const token = await getToken();
    await fetch(`/api/incidents/${id}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeId: assigneeId ? parseInt(assigneeId) : null }),
    });
    fetchDetails();
  };

  const handleStatusChange = async (newStatus: string) => {
    const token = await getToken();
    await fetch('/api/incidents/bulk', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id], action: newStatus === 'resolved' ? 'resolve' : 'investigate' }),
    });
    fetchDetails();
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const token = await getToken();
    await fetch(`/api/incidents/${id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment.trim() }),
    });
    setNewComment('');
    fetchDetails();
  };

  const combinedTimeline = useMemo(() => {
    if (!incident) return [];
    const events: any[] = [];
    incident.alerts?.forEach((a: any) => events.push({ ...a, _type: 'alert', _time: new Date(a.receivedAt).getTime() }));
    incident.remediationActions?.forEach((r: any) => events.push({ ...r, _type: 'remediation', _time: new Date(r.createdAt).getTime() }));
    incident.auditLogs?.forEach((l: any) => events.push({ ...l, _type: 'log', _time: new Date(l.createdAt).getTime() }));
    return events.sort((a, b) => b._time - a._time);
  }, [incident]);

  const getSLA = () => {
    if (!incident) return null;
    const targets = { sev1: 15, sev2: 60, sev3: 1440 };
    const targetMins = targets[incident.severity as keyof typeof targets] || 60;
    const start = new Date(incident.triggeredAt);
    const end = incident.status === 'resolved' && incident.resolvedAt ? new Date(incident.resolvedAt) : new Date();
    const elapsedMins = differenceInMinutes(end, start);
    return {
      elapsedMins,
      targetMins,
      percentage: Math.min((elapsedMins / targetMins) * 100, 100),
      isBreached: elapsedMins > targetMins,
    };
  };

  if (loading) return <div className="p-8 text-center text-mute">Loading incident…</div>;
  if (!incident) return <div className="p-8 text-center text-red-400">Incident not found</div>;

  const sla = getSLA();

  return (
    <div className="flex-1 w-full p-4 sm:p-8 overflow-auto" id="pdf-content">
      <div className="max-w-[1200px] mx-auto w-full">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-mute hover:text-paper mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to queue
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="font-mono text-xs text-ember mb-2">INC-{1000 + incident.id}</div>
            <h1 className="text-2xl sm:text-3xl font-semibold max-w-3xl">{incident.title}</h1>
          </div>
          {viewers.length > 0 && (
            <div className="flex items-center gap-2 border border-line rounded-full px-2 py-1">
              <div className="flex -space-x-1.5">
                {viewers.map((v) => (
                  <div key={v.userId} className="h-6 w-6 rounded-full ring-2 ring-ink bg-ember flex items-center justify-center text-[10px] font-bold" title={v.email}>
                    {(v.name || v.email || '?')[0].toUpperCase()}
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-mute px-1">{viewers.length} viewing</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={handleInvestigate} disabled={investigating} className="px-3 py-1.5 rounded-xl bg-ember text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2">
            <BrainCircuit className="w-4 h-4" /> {investigating ? 'Investigating…' : 'Run investigation'}
          </button>
          <button onClick={handleSummarize} disabled={summarizing} className="px-3 py-1.5 rounded-xl bg-raised border border-line text-sm inline-flex items-center gap-2 disabled:opacity-50">
            <Wand2 className="w-4 h-4 text-ember" /> {summarizing ? 'Summarizing…' : 'Executive summary'}
          </button>
          <button onClick={handleCreateJira} disabled={creatingJira} className="px-3 py-1.5 rounded-xl bg-raised border border-line text-sm inline-flex items-center gap-2">
            <FileText className="w-4 h-4" /> {creatingJira ? 'Syncing…' : 'Sync to Jira'}
          </button>
          <button onClick={handleExportPDF} className="px-3 py-1.5 rounded-xl bg-raised border border-line text-sm inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
        {jiraMessage && <p className="text-xs text-mute -mt-6 mb-6">{jiraMessage}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section>
              <h3 className="text-sm font-semibold mb-2">What we know</h3>
              <p className="text-sm text-mute whitespace-pre-wrap leading-relaxed">{incident.description}</p>
            </section>

            {aiSummary && (
              <div className="bg-raised border border-line p-4 rounded-2xl">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-ember" /> Executive summary
                </h4>
                <div className="text-sm text-paper/90 space-y-1">
                  {aiSummary.split('\n').map((line, i) => (
                    <p key={i}>{line.replace(/\*\*/g, '')}</p>
                  ))}
                </div>
              </div>
            )}

            {incident.rootCauses?.length > 0 && (
              <div className="border border-line rounded-2xl overflow-hidden">
                <div className="bg-panel px-4 py-3 border-b border-line text-sm font-semibold">Root cause hypotheses</div>
                <div className="p-4 space-y-4">
                  {incident.rootCauses.map((rc: any) => (
                    <div key={rc.id}>
                      <div className="flex justify-between gap-3 mb-2">
                        <span className="text-sm font-medium">{rc.hypothesis}</span>
                        <span className="text-xs font-mono text-ember shrink-0">{rc.confidence}%</span>
                      </div>
                      <ul className="space-y-1">
                        {(Array.isArray(rc.evidence) ? rc.evidence : []).map((ev: string, i: number) => (
                          <li key={i} className="text-xs text-mute bg-raised p-2 rounded-lg border border-line">
                            {ev}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {incident.remediationActions?.length > 0 && (
              <div className="border border-amber-500/30 rounded-2xl overflow-hidden bg-amber-500/5">
                <div className="px-4 py-3 border-b border-amber-500/20 text-sm font-semibold">Remediation — human approval required</div>
                <div className="p-4 space-y-4">
                  {incident.remediationActions.map((action: any) => (
                    <div key={action.id} className="border border-line rounded-xl p-4 bg-panel">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs font-mono text-mute">{action.actionType}</span>
                        <span className="text-[10px] uppercase tracking-wide text-amber-200">{action.status}</span>
                      </div>
                      <p className="text-sm mb-4">{action.description}</p>
                      {action.status === 'proposed' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(action.id, 'approve')} className="bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg text-sm">
                            Approve
                          </button>
                          <button onClick={() => handleAction(action.id, 'reject')} className="bg-raised border border-line px-3 py-1.5 rounded-lg text-sm">
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="border-b border-line flex gap-6 mb-4">
                {['details', 'timeline'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 text-sm capitalize ${activeTab === tab ? 'text-ember border-b-2 border-ember' : 'text-mute'}`}
                  >
                    {tab === 'details' ? 'Comments' : 'Timeline'}
                  </button>
                ))}
              </div>

              {activeTab === 'details' && (
                <div className="space-y-4">
                  {incident.comments?.map((comment: any) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-raised flex items-center justify-center text-xs font-bold shrink-0">
                        {(comment.user?.name || comment.user?.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex gap-2 items-baseline mb-1">
                          <span className="text-sm font-medium">{comment.user?.name || comment.user?.email || 'Unknown'}</span>
                          <span className="text-xs text-mute">{format(new Date(comment.createdAt), 'MMM d, HH:mm')}</span>
                        </div>
                        <div className="text-sm bg-panel border border-line p-3 rounded-xl whitespace-pre-wrap">{comment.content}</div>
                      </div>
                    </div>
                  ))}
                  <form onSubmit={handlePostComment} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-ember text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {(currentUser?.email || 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <textarea
                        rows={2}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a note for the next on-call…"
                        className="w-full bg-panel border border-line focus:border-ember rounded-xl px-3 py-2 text-sm outline-none mb-2"
                      />
                      <button type="submit" disabled={!newComment.trim()} className="bg-ember disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-sm">
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  {combinedTimeline.map((event: any, i: number) => (
                    <div key={i} className="flex gap-4">
                      <div className={`w-2 h-2 rounded-full mt-2 ${event._type === 'alert' ? 'bg-red-400' : event._type === 'remediation' ? 'bg-amber-400' : 'bg-ember'}`} />
                      <div>
                        <div className="text-xs text-mute">{format(new Date(event._time), 'MMM d, HH:mm:ss')}</div>
                        {event._type === 'alert' && <div className="text-sm">Alert: {event.title} ({event.source})</div>}
                        {event._type === 'remediation' && <div className="text-sm">Remediation ({event.status}): {event.actionType}</div>}
                        {event._type === 'log' && <div className="text-sm">{event.action}</div>}
                      </div>
                    </div>
                  ))}
                  {combinedTimeline.length === 0 && <p className="text-sm text-mute">No events yet.</p>}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <select
              value={incident.status === 'pending_approval' ? 'investigating' : incident.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full text-sm bg-panel border border-line rounded-xl px-3 py-2 outline-none"
            >
              <option value="triggered">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
            </select>

            <div className="border border-line rounded-2xl bg-panel p-4 space-y-4">
              <h3 className="text-sm font-semibold">Details</h3>
              <label className="block text-xs text-mute">
                Assignee
                <select
                  value={incident.assigneeId || ''}
                  onChange={(e) => handleAssign(e.target.value)}
                  className="mt-1 w-full text-sm bg-ink border border-line rounded-lg px-2 py-1.5"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-sm">
                <span className="text-mute text-xs block">Severity</span>
                <span className="uppercase font-mono">{incident.severity}</span>
              </div>
              <div>
                <span className="text-mute text-xs block mb-1">Labels</span>
                <div className="flex flex-wrap gap-1">
                  {incident.tags?.map((tag: string) => (
                    <span key={tag} className="flex items-center text-xs bg-raised px-1.5 py-0.5 rounded-md">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-1 text-mute hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {isAddingTag ? (
                    <form onSubmit={handleAddTag} className="w-full mt-1">
                      <input
                        type="text"
                        autoFocus
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onBlur={() => setIsAddingTag(false)}
                        className="w-full text-sm bg-ink border border-ember rounded-lg px-2 py-1 outline-none"
                        placeholder="Add label…"
                      />
                    </form>
                  ) : (
                    <button onClick={() => setIsAddingTag(true)} className="text-xs text-ember">
                      + Add
                    </button>
                  )}
                </div>
              </div>
            </div>

            {sla && (
              <div className="border border-line rounded-2xl bg-panel p-4">
                <h3 className="text-sm font-semibold mb-3">Time to resolution</h3>
                <div className={`text-sm mb-2 ${sla.isBreached ? 'text-red-400' : ''}`}>
                  {sla.elapsedMins}m / {sla.targetMins}m
                </div>
                <div className="w-full h-1.5 bg-raised rounded-full overflow-hidden">
                  <div className={`h-full ${sla.isBreached ? 'bg-red-500' : 'bg-emerald-400'}`} style={{ width: `${sla.percentage}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
