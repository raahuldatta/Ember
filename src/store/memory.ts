type IncidentStatus = 'triggered' | 'investigating' | 'pending_approval' | 'resolved' | 'aborted';
type Severity = 'sev1' | 'sev2' | 'sev3';

export type MemoryUser = {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: string;
  githubToken?: string | null;
};

export type MemoryIncident = {
  id: number;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: Severity;
  triggeredAt: Date;
  resolvedAt: Date | null;
  affectedServices: string[];
  tags: string[];
  assignedTeam: string;
  assigneeId: number | null;
  pagerdutyId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MemoryState = {
  users: MemoryUser[];
  incidents: MemoryIncident[];
  alerts: any[];
  rootCauses: any[];
  remediationActions: any[];
  auditLogs: any[];
  comments: any[];
  rcaTemplates: any[];
  triageRules: any[];
  seq: Record<string, number>;
};

function now() {
  return new Date();
}

function minutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60_000);
}

function nextId(state: MemoryState, key: string) {
  state.seq[key] = (state.seq[key] || 0) + 1;
  return state.seq[key];
}

function seed(): MemoryState {
  const state: MemoryState = {
    users: [],
    incidents: [],
    alerts: [],
    rootCauses: [],
    remediationActions: [],
    auditLogs: [],
    comments: [],
    rcaTemplates: [],
    triageRules: [],
    seq: {},
  };

  const demo = {
    id: nextId(state, 'users'),
    uid: 'demo',
    email: 'oncall@ember.dev',
    name: 'On-call Engineer',
    role: 'engineer',
    githubToken: null,
  };
  const sre = {
    id: nextId(state, 'users'),
    uid: 'sre-maya',
    email: 'maya@ember.dev',
    name: 'Maya Chen',
    role: 'admin',
    githubToken: null,
  };
  state.users.push(demo, sre);

  const checkoutId = nextId(state, 'incidents');
  const checkout: MemoryIncident = {
    id: checkoutId,
    title: 'High API error rate on checkout service',
    description:
      'Checkout API 5xx rate crossed 5% in the last 5 minutes. Payment latency is elevated and the error budget for the checkout SLO is burning fast.',
    status: 'triggered',
    severity: 'sev1',
    triggeredAt: minutesAgo(12),
    resolvedAt: null,
    affectedServices: ['checkout-api', 'payment-gateway'],
    tags: ['checkout', 'payments', 'customer-facing'],
    assignedTeam: 'Platform Engineering',
    assigneeId: demo.id,
    pagerdutyId: 'ember-pd-checkout',
    createdAt: minutesAgo(12),
    updatedAt: minutesAgo(12),
  };

  const searchId = nextId(state, 'incidents');
  const search: MemoryIncident = {
    id: searchId,
    title: 'Search p99 latency regression after index rebuild',
    description:
      'Product search p99 jumped from 180ms to 2.4s following an Elasticsearch index rebuild. Autocomplete is degraded.',
    status: 'investigating',
    severity: 'sev2',
    triggeredAt: minutesAgo(47),
    resolvedAt: null,
    affectedServices: ['search-api', 'elasticsearch'],
    tags: ['search', 'latency'],
    assignedTeam: 'Discovery',
    assigneeId: sre.id,
    createdAt: minutesAgo(47),
    updatedAt: minutesAgo(20),
  };

  const notifyId = nextId(state, 'incidents');
  const notify: MemoryIncident = {
    id: notifyId,
    title: 'Notification worker backlog growing',
    description: 'SQS queue depth for notification-worker exceeded 50k messages. Email/SMS delivery delayed.',
    status: 'pending_approval',
    severity: 'sev2',
    triggeredAt: minutesAgo(90),
    resolvedAt: null,
    affectedServices: ['notification-worker', 'sqs'],
    tags: ['notifications', 'backlog'],
    assignedTeam: 'Messaging',
    assigneeId: demo.id,
    createdAt: minutesAgo(90),
    updatedAt: minutesAgo(15),
  };

  const authId = nextId(state, 'incidents');
  const auth: MemoryIncident = {
    id: authId,
    title: 'Auth token refresh failures in EU region',
    description: 'A subset of EU users cannot refresh JWT sessions. Error: JWKS endpoint timeout.',
    status: 'resolved',
    severity: 'sev1',
    triggeredAt: minutesAgo(220),
    resolvedAt: minutesAgo(40),
    affectedServices: ['auth-service', 'jwks'],
    tags: ['auth', 'eu'],
    assignedTeam: 'Identity',
    assigneeId: sre.id,
    createdAt: minutesAgo(220),
    updatedAt: minutesAgo(40),
  };

  const cacheId = nextId(state, 'incidents');
  const cache: MemoryIncident = {
    id: cacheId,
    title: 'Redis CPU saturation on session cache',
    description: 'session-cache Redis node CPU pinned at 97%. Session reads falling back to Postgres.',
    status: 'triggered',
    severity: 'sev3',
    triggeredAt: minutesAgo(8),
    resolvedAt: null,
    affectedServices: ['session-cache', 'redis'],
    tags: ['cache', 'redis'],
    assignedTeam: 'Platform Engineering',
    assigneeId: null,
    createdAt: minutesAgo(8),
    updatedAt: minutesAgo(8),
  };

  state.incidents.push(checkout, search, notify, auth, cache);

  state.alerts.push(
    {
      id: nextId(state, 'alerts'),
      incidentId: checkoutId,
      source: 'Datadog',
      title: 'API Error Rate > 5%',
      externalId: 'dd-12345',
      payload: { query: 'avg(last_5m):sum:http.errors{service:checkout} > 5' },
      receivedAt: minutesAgo(12),
    },
    {
      id: nextId(state, 'alerts'),
      incidentId: checkoutId,
      source: 'PagerDuty',
      title: 'Checkout SLO burn rate 14x',
      receivedAt: minutesAgo(11),
    },
    {
      id: nextId(state, 'alerts'),
      incidentId: searchId,
      source: 'Grafana',
      title: 'search-api p99 > 2s',
      receivedAt: minutesAgo(47),
    },
    {
      id: nextId(state, 'alerts'),
      incidentId: notifyId,
      source: 'CloudWatch',
      title: 'SQS ApproximateNumberOfMessagesVisible > 50000',
      receivedAt: minutesAgo(90),
    }
  );

  state.rootCauses.push({
    id: nextId(state, 'rootCauses'),
    incidentId: notifyId,
    hypothesis: 'A bad deploy reduced worker concurrency from 32 to 4, causing the notification backlog to grow.',
    evidence: [
      'Deploy 441 reduced NOTIFY_CONCURRENCY to 4 at 21:04 UTC',
      'Worker CPU is idle while queue depth climbs — not a resource starvation issue',
      'Similar incident INC-1003 on 2025-11-02 after the same config flag change',
    ],
    confidence: 88,
    createdAt: minutesAgo(18),
  });

  state.remediationActions.push({
    id: nextId(state, 'actions'),
    incidentId: notifyId,
    description: 'Roll back notification-worker to the previous revision and restore concurrency to 32.',
    actionType: 'rollback_deployment',
    actionPayload: { deployId: '441', service: 'notification-worker' },
    status: 'proposed',
    createdAt: minutesAgo(18),
  });

  state.auditLogs.push(
    {
      id: nextId(state, 'logs'),
      incidentId: checkoutId,
      userId: demo.id,
      action: 'Incident opened from Datadog webhook',
      details: { source: 'Datadog' },
      createdAt: minutesAgo(12),
    },
    {
      id: nextId(state, 'logs'),
      incidentId: notifyId,
      userId: demo.id,
      action: 'AI investigation completed',
      details: { confidence: 88 },
      createdAt: minutesAgo(18),
    },
    {
      id: nextId(state, 'logs'),
      incidentId: authId,
      userId: sre.id,
      action: 'Resolved after failover of JWKS cache',
      details: {},
      createdAt: minutesAgo(40),
    }
  );

  state.comments.push({
    id: nextId(state, 'comments'),
    incidentId: searchId,
    userId: sre.id,
    content: 'Index rebuild is still running on the warm replica. Holding off on a full cluster restart.',
    createdAt: minutesAgo(22),
  });

  state.rcaTemplates.push({
    id: nextId(state, 'templates'),
    name: 'Standard Microservice Outage',
    content:
      '1. Affected Systems:\n2. Timeline of Events:\n3. Monitoring Data Links:\n4. Potential Contributing Factors:\n5. Immediate Mitigation Steps Taken:',
    createdAt: now(),
  });

  return state;
}

const g = globalThis as any;
if (!g.__emberMemory) g.__emberMemory = seed();

export function memory(): MemoryState {
  return g.__emberMemory as MemoryState;
}

export function resetMemory() {
  g.__emberMemory = seed();
}

export function insert<T extends { id: number }>(collection: T[], row: Omit<T, 'id'> & { id?: number }, key: string): T {
  const id = row.id ?? nextId(memory(), key);
  const created = { ...row, id } as T;
  collection.push(created);
  return created;
}

export { nextId };
