import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import Dashboard from './components/Dashboard';
import IncidentDetails from './components/IncidentDetails';
import Reports from './components/Reports';
import { Activity, Flame, Github, LayoutDashboard, LogOut, Menu, Settings, ShieldAlert, X } from 'lucide-react';

type View = 'incidents' | 'alerts' | 'reports' | 'settings';

function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const icon = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className={`${box} rounded-xl bg-gradient-to-br from-ember to-amber-600 flex items-center justify-center shadow-[0_0_24px_rgba(255,107,44,0.35)]`}>
      <Flame className={`${icon} text-white`} />
    </div>
  );
}

function MainApp() {
  const { user, loading, signIn, signInDemo, signOut, getToken, googleAvailable } = useAuth();
  const [selectedIncident, setSelectedIncident] = useState<number | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [isLivePolling, setIsLivePolling] = useState(true);
  const [view, setView] = useState<View>('incidents');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    let lastCheckedDate = new Date().toISOString();
    const pollForIncidents = async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/incidents', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const newCriticalIncidents = data.filter(
          (inc: any) => inc.severity === 'sev1' && new Date(inc.createdAt) > new Date(lastCheckedDate)
        );
        if (newCriticalIncidents.length > 0) {
          lastCheckedDate = new Date().toISOString();
          if (Notification.permission === 'granted') {
            newCriticalIncidents.forEach((inc: any) => {
              new Notification('Critical incident', { body: inc.title });
            });
          }
        }
      } catch (e) {
        console.error('Failed to poll for notifications', e);
      }
    };

    const intervalId = setInterval(pollForIncidents, 10000);
    return () => clearInterval(intervalId);
  }, [user, getToken]);

  useEffect(() => {
    if (!user) return;
    const checkGithub = async () => {
      const token = await getToken();
      const res = await fetch('/api/user/github-status', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setGithubConnected(data.connected);
      }
    };
    checkGithub();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') setGithubConnected(true);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user, getToken]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIncident !== null) setSelectedIncident(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIncident]);

  const handleConnectGithub = async () => {
    const token = await getToken();
    const res = await fetch('/api/auth/github/url', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const { url } = await res.json();
      window.open(url, 'github_oauth', 'width=600,height=700');
    }
  };

  const goHome = () => {
    setSelectedIncident(null);
    setView('incidents');
    setSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center ember-grid text-mute">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="text-paper font-medium">Warming Ember…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-full ember-grid flex flex-col">
        <header className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="text-lg font-semibold tracking-tight">Ember</div>
              <div className="text-xs text-mute">AI Incident Response Engineer</div>
            </div>
          </div>
          <span className="text-xs font-mono text-mute hidden sm:block">humans approve · agents investigate</span>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 pb-16">
          <div className="w-full max-w-lg">
            <p className="text-ember font-mono text-xs tracking-[0.2em] uppercase mb-4">On-call, with a first pass done</p>
            <h1 className="text-4xl sm:text-5xl font-semibold leading-tight mb-4">
              Evidence first.<br />Then a hypothesis.
            </h1>
            <p className="text-mute text-base mb-8 max-w-md">
              Ember aggregates alerts, traces deployments, and drafts a root-cause report. Remediation never runs until you say so.
            </p>

            <div className="rounded-2xl border border-line bg-panel/80 backdrop-blur p-6 space-y-3">
              <button
                onClick={signInDemo}
                className="w-full flex items-center justify-center gap-2 bg-ember hover:bg-ember-hot text-white py-3 rounded-xl font-semibold transition-colors"
              >
                <ShieldAlert className="w-4 h-4" />
                Enter demo workspace
              </button>
              {googleAvailable && (
                <button
                  onClick={signIn}
                  className="w-full flex items-center justify-center gap-3 bg-raised border border-line text-paper py-3 rounded-xl font-medium hover:border-mute transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>
              )}
              <p className="text-xs text-mute text-center pt-1">
                Demo mode uses an in-memory store. No production actions are executed.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const nav = [
    { id: 'incidents' as View, label: 'Incidents', icon: LayoutDashboard },
    { id: 'alerts' as View, label: 'Active alerts', icon: Activity },
    { id: 'reports' as View, label: 'Reports', icon: ShieldAlert },
    { id: 'settings' as View, label: 'Integrations', icon: Settings },
  ];

  return (
    <div className="h-full flex flex-col bg-ink text-paper">
      <header className="h-14 flex items-center justify-between px-3 sm:px-4 border-b border-line bg-panel z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 rounded-lg hover:bg-raised" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2" onClick={goHome}>
            <BrandMark size="sm" />
            <span className="text-lg font-semibold tracking-tight">Ember</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-raised border border-line text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 ember-pulse" />
            PagerDuty
          </div>
          {githubConnected ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-raised border border-line text-xs">
              <Github className="w-3.5 h-3.5" /> Connected
            </div>
          ) : (
            <button onClick={handleConnectGithub} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-raised border border-line text-xs hover:border-ember">
              <Github className="w-3.5 h-3.5" /> GitHub
            </button>
          )}
          {!selectedIncident && (
            <button
              onClick={() => setIsLivePolling(!isLivePolling)}
              className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded-lg border ${isLivePolling ? 'border-ember/40 text-ember' : 'border-line text-mute'}`}
            >
              {isLivePolling ? 'Live' : 'Paused'}
            </button>
          )}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ember to-amber-700 flex items-center justify-center text-xs font-bold" title={user.email || ''}>
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
          <button onClick={signOut} className="p-2 text-mute hover:text-paper rounded-lg hover:bg-raised" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <button className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />
        )}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-50 w-64 flex flex-col bg-panel border-r border-line transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 pt-14 md:pt-0`}
        >
          <div className="md:hidden absolute top-3 right-3">
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-raised">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 border-b border-line">
            <div className="text-sm font-semibold">Command center</div>
            <p className="text-xs text-mute mt-0.5">{user.demo ? 'Demo workspace' : user.email}</p>
          </div>
          <nav className="flex-1 py-3 px-2 space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = view === item.id && selectedIncident === null;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    setSelectedIncident(null);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-ember/15 text-ember' : 'text-mute hover:text-paper hover:bg-raised'}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-ink">
          {selectedIncident ? (
            <IncidentDetails id={selectedIncident} onBack={() => setSelectedIncident(null)} />
          ) : view === 'reports' ? (
            <Reports />
          ) : view === 'settings' ? (
            <Integrations githubConnected={githubConnected} onConnectGithub={handleConnectGithub} />
          ) : (
            <Dashboard
              onSelectIncident={setSelectedIncident}
              isLivePolling={isLivePolling}
              alertsOnly={view === 'alerts'}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Integrations({ githubConnected, onConnectGithub }: { githubConnected: boolean; onConnectGithub: () => void }) {
  const rows = [
    { name: 'PagerDuty', hint: 'SEV-1 paging', ready: true },
    { name: 'Slack', hint: 'Channel updates', ready: true },
    { name: 'Jira', hint: 'Ticket sync', ready: false },
    { name: 'GitHub', hint: 'Deploy correlation', ready: githubConnected },
    { name: 'Gemini', hint: 'Investigation LLM', ready: false },
  ];
  return (
    <div className="flex-1 overflow-auto p-6 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Integrations</h1>
        <p className="text-sm text-mute mb-6">Ember consumes your tools. It does not replace them. Secrets stay on the server.</p>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-4">
              <div>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-mute">{row.hint}</div>
              </div>
              {row.name === 'GitHub' && !row.ready ? (
                <button onClick={onConnectGithub} className="text-sm px-3 py-1.5 rounded-lg bg-ember text-white font-medium">
                  Connect
                </button>
              ) : (
                <span className={`text-xs font-mono ${row.ready ? 'text-emerald-400' : 'text-mute'}`}>{row.ready ? 'ready' : 'env not set'}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
