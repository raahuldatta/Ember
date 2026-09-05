import { hasPostgres, db } from '../db/index.ts';
import { users, incidents, alerts, rootCauses, remediationActions, auditLogs, comments, rcaTemplates, triageRules } from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { memory, insert, MemoryUser } from './memory.ts';

export function isMemoryMode() {
  return !hasPostgres();
}

export async function upsertUser(uid: string, email: string, name: string): Promise<MemoryUser> {
  if (isMemoryMode()) {
    const existing = memory().users.find((u) => u.uid === uid);
    if (existing) {
      existing.email = email;
      existing.name = name || existing.name;
      return existing;
    }
    return insert(memory().users, { uid, email, name, role: 'engineer', githubToken: null }, 'users');
  }
  const result = await db.insert(users).values({ uid, email, name }).onConflictDoUpdate({
    target: users.uid,
    set: { email, name },
  }).returning();
  return result[0];
}

export async function getUserByUid(uid: string) {
  if (isMemoryMode()) return memory().users.find((u) => u.uid === uid) || null;
  const [user] = await db.select().from(users).where(eq(users.uid, uid));
  return user || null;
}

export async function setGithubToken(uid: string, token: string) {
  if (isMemoryMode()) {
    const user = memory().users.find((u) => u.uid === uid);
    if (user) user.githubToken = token;
    return;
  }
  await db.update(users).set({ githubToken: token }).where(eq(users.uid, uid));
}

export async function listUsers() {
  if (isMemoryMode()) return memory().users.map(({ id, name, email }) => ({ id, name, email }));
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users);
}

export async function listIncidents() {
  if (isMemoryMode()) {
    return [...memory().incidents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return db.select().from(incidents).orderBy(desc(incidents.createdAt));
}

export async function getIncident(id: number) {
  if (isMemoryMode()) return memory().incidents.find((i) => i.id === id) || null;
  const [incident] = await db.select().from(incidents).where(eq(incidents.id, id));
  return incident || null;
}

export async function createIncident(data: {
  title: string;
  description?: string;
  severity?: string;
  assignedTeam?: string;
  pagerdutyId?: string;
  affectedServices?: string[];
  status?: string;
}) {
  if (isMemoryMode()) {
    const created = insert(
      memory().incidents,
      {
        title: data.title,
        description: data.description || '',
        status: (data.status as any) || 'triggered',
        severity: (data.severity as any) || 'sev2',
        triggeredAt: new Date(),
        resolvedAt: null,
        affectedServices: data.affectedServices || [],
        tags: [],
        assignedTeam: data.assignedTeam || 'Triage',
        assigneeId: null,
        pagerdutyId: data.pagerdutyId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'incidents'
    );
    return created;
  }
  const [newIncident] = await db.insert(incidents).values({
    title: data.title,
    description: data.description,
    severity: (data.severity as any) || 'sev2',
    status: 'triggered',
    assignedTeam: data.assignedTeam || 'Triage',
    pagerdutyId: data.pagerdutyId,
    affectedServices: data.affectedServices,
  }).returning();
  return newIncident;
}

export async function updateIncident(id: number, patch: Record<string, any>) {
  if (isMemoryMode()) {
    const incident = memory().incidents.find((i) => i.id === id);
    if (!incident) return null;
    Object.assign(incident, patch, { updatedAt: new Date() });
    return incident;
  }
  const [updated] = await db.update(incidents).set(patch).where(eq(incidents.id, id)).returning();
  return updated;
}

export async function addAlert(row: any) {
  if (isMemoryMode()) return insert(memory().alerts, { receivedAt: new Date(), ...row }, 'alerts');
  const [alert] = await db.insert(alerts).values(row).returning();
  return alert;
}

export async function addAudit(row: any) {
  if (isMemoryMode()) return insert(memory().auditLogs, { createdAt: new Date(), ...row }, 'logs');
  const [log] = await db.insert(auditLogs).values(row).returning();
  return log;
}

export async function addRootCause(row: any) {
  if (isMemoryMode()) return insert(memory().rootCauses, { createdAt: new Date(), ...row }, 'rootCauses');
  const [rc] = await db.insert(rootCauses).values(row).returning();
  return rc;
}

export async function addAction(row: any) {
  if (isMemoryMode()) return insert(memory().remediationActions, { createdAt: new Date(), ...row }, 'actions');
  const [action] = await db.insert(remediationActions).values(row).returning();
  return action;
}

export async function addComment(row: any) {
  if (isMemoryMode()) return insert(memory().comments, { createdAt: new Date(), ...row }, 'comments');
  const [comment] = await db.insert(comments).values(row).returning();
  return comment;
}

export async function listAlerts(incidentId: number) {
  if (isMemoryMode()) {
    return memory().alerts.filter((a) => a.incidentId === incidentId).sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
  }
  return db.select().from(alerts).where(eq(alerts.incidentId, incidentId)).orderBy(desc(alerts.receivedAt));
}

export async function listRootCauses(incidentId: number) {
  if (isMemoryMode()) {
    return memory().rootCauses.filter((a) => a.incidentId === incidentId).sort((a, b) => b.confidence - a.confidence);
  }
  return db.select().from(rootCauses).where(eq(rootCauses.incidentId, incidentId)).orderBy(desc(rootCauses.confidence));
}

export async function listActions(incidentId: number) {
  if (isMemoryMode()) {
    return memory().remediationActions.filter((a) => a.incidentId === incidentId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  return db.select().from(remediationActions).where(eq(remediationActions.incidentId, incidentId)).orderBy(desc(remediationActions.createdAt));
}

export async function listLogs(incidentId: number) {
  if (isMemoryMode()) {
    return memory().auditLogs.filter((a) => a.incidentId === incidentId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  return db.select().from(auditLogs).where(eq(auditLogs.incidentId, incidentId)).orderBy(desc(auditLogs.createdAt));
}

export async function listComments(incidentId: number) {
  if (isMemoryMode()) {
    return memory()
      .comments.filter((c) => c.incidentId === incidentId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((c) => ({
        ...c,
        user: memory().users.find((u) => u.id === c.userId) || null,
      }));
  }
  return db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      user: { id: users.id, name: users.name, email: users.email },
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.incidentId, incidentId))
    .orderBy(desc(comments.createdAt));
}

export async function getUserById(id: number) {
  if (isMemoryMode()) return memory().users.find((u) => u.id === id) || null;
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, id));
  return user || null;
}

export async function getAction(id: number) {
  if (isMemoryMode()) return memory().remediationActions.find((a) => a.id === id) || null;
  const [action] = await db.select().from(remediationActions).where(eq(remediationActions.id, id));
  return action || null;
}

export async function updateAction(id: number, patch: Record<string, any>) {
  if (isMemoryMode()) {
    const action = memory().remediationActions.find((a) => a.id === id);
    if (!action) return null;
    Object.assign(action, patch);
    return action;
  }
  const [updated] = await db.update(remediationActions).set(patch).where(eq(remediationActions.id, id)).returning();
  return updated;
}

export async function listRcaTemplates() {
  if (isMemoryMode()) return memory().rcaTemplates;
  let templates = await db.select().from(rcaTemplates);
  if (templates.length === 0) {
    const [t] = await db.insert(rcaTemplates).values({
      name: 'Standard Microservice Outage',
      content: '1. Affected Systems:\n2. Timeline of Events:\n3. Monitoring Data Links:\n4. Potential Contributing Factors:\n5. Immediate Mitigation Steps Taken:',
    }).returning();
    templates = [t];
  }
  return templates;
}

export async function listTriageRules() {
  if (isMemoryMode()) return memory().triageRules.filter((r) => r.isActive !== false);
  return db.select().from(triageRules).where(eq(triageRules.isActive, true));
}

export async function seedIfEmpty() {
  if (isMemoryMode()) {
    return { success: true, message: 'Demo workspace already contains sample incidents' };
  }
  const existing = await db.select().from(incidents);
  if (existing.length > 0) return { success: true, message: 'Already seeded' };
  const [incident] = await db.insert(incidents).values({
    title: 'High API Error Rate on Checkout Service',
    description: 'Multiple 500 errors returned from the checkout API endpoint within the last 5 minutes.',
    status: 'triggered',
    severity: 'sev1',
    affectedServices: ['checkout-api', 'payment-gateway'],
    assignedTeam: 'Platform Engineering',
  }).returning();
  await db.insert(alerts).values({
    incidentId: incident.id,
    source: 'Datadog',
    title: 'API Error Rate > 5%',
    externalId: 'dd-12345',
    payload: { query: 'avg(last_5m):sum:http.errors{service:checkout} > 5' },
  });
  return { success: true, message: 'Seed completed' };
}
