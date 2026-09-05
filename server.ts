import "dotenv/config";
import express, { type Express } from "express";
import path from "path";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import * as repo from "./src/store/repo.ts";
import { isMemoryMode } from "./src/store/repo.ts";
import { GoogleGenAI } from "@google/genai";

const incidentViewers = new Map<string, { userId: number; name: string; email: string; lastSeen: number }[]>();

let appPromise: Promise<Express> | null = null;

export function createApp() {
  if (!appPromise) appPromise = buildApp();
  return appPromise;
}

async function buildApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", mode: isMemoryMode() ? "demo" : "postgres" });
  });

  app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || "";
      const name = (req.user as any).name || "";
      const user = await repo.upsertUser(uid, email, name);
      res.json(user);
    } catch (error) {
      console.error("Auth sync error:", error);
      res.status(500).json({ error: "Failed to sync user" });
    }
  });

  app.get("/api/auth/github/url", requireAuth, (req: AuthRequest, res) => {
    const origin = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || "",
      redirect_uri: `${origin}/auth/github/callback`,
      scope: "repo",
      state: req.user?.uid || "",
    });
    res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
  });

  app.get(["/auth/github/callback", "/auth/github/callback/"], async (req, res) => {
    const { code, state } = req.query;
    try {
      if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        throw new Error("GitHub Client ID/Secret not configured.");
      }
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const data = await tokenRes.json();
      if (data.access_token && state) {
        await repo.setGithubToken(state as string, data.access_token);
      }
      const origin = process.env.APP_URL || "";
      res.send(`
        <html><body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS' }, ${JSON.stringify(origin || "*")});
              window.close();
            } else { window.location.href = '/'; }
          </script>
          <p>GitHub connected successfully. You can close this window.</p>
        </body></html>
      `);
    } catch (e: any) {
      res.status(500).send(`Error connecting to GitHub: ${e.message}`);
    }
  });

  app.get("/api/user/github-status", requireAuth, async (req: AuthRequest, res) => {
    res.json({ connected: Boolean(req.dbUser?.githubToken) });
  });

  app.post("/api/incidents/:id/summarize", requireAuth, async (req: AuthRequest, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const incident = await repo.getIncident(incidentId);
      if (!incident) return res.status(404).json({ error: "Not found" });

      const incidentAlerts = await repo.listAlerts(incidentId);
      const incidentLogs = await repo.listLogs(incidentId);

      let summary = `• Impact: ${incident.title} (${incident.severity.toUpperCase()}) affecting ${(incident.affectedServices || []).join(", ") || "unknown services"}.
• Current state: ${incident.status.replace("_", " ")}.
• Signals: ${incidentAlerts.map((a: any) => a.title).slice(0, 3).join("; ") || "no alerts attached"}.
• Recent actions: ${incidentLogs.map((l: any) => l.action).slice(0, 3).join("; ") || "none yet"}.
• Next step: run AI investigation if root cause is empty, then approve any proposed remediation.`;

      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const prompt = `You are an executive summarization AI. Write a concise, bulleted executive summary (under 150 words) for the following incident. Include the impact, current state, and key actions taken.
      Title: ${incident.title}
      Description: ${incident.description}
      Status: ${incident.status}
      Alerts: ${JSON.stringify(incidentAlerts.map((a: any) => a.title))}
      Actions/Logs: ${JSON.stringify(incidentLogs.map((l: any) => l.action))}
      `;
          const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
          if (response.text) summary = response.text;
        } catch (err) {
          console.error("Summarize LLM failed, using local summary.", err);
        }
      }

      await repo.addAudit({
        incidentId,
        userId: req.dbUser?.id,
        action: "Generated Executive Summary via AI",
        details: { summary },
      });

      res.json({ summary });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const seedHandler = async (_req: AuthRequest, res: express.Response) => {
    try {
      res.json(await repo.seedIfEmpty());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };
  app.post("/api/seed", requireAuth, seedHandler);
  app.post("/api/incidents/seed", requireAuth, seedHandler);

  app.post("/api/webhooks/alerts", async (req, res) => {
    try {
      const alertData = req.body;
      let title = alertData.title || alertData.summary || "Unknown Alert";
      let source = alertData.source || "Webhook";
      let severity = "sev2";
      let assignedTeam = "Unassigned";

      const rules = await repo.listTriageRules();
      for (const rule of rules) {
        let fieldValue = "";
        if (rule.conditionField === "source") fieldValue = source;
        else if (rule.conditionField === "title") fieldValue = title;
        else if (rule.conditionField?.startsWith("payload.")) {
          const key = rule.conditionField.split(".")[1];
          fieldValue = alertData[key] || "";
        }
        let isMatch = false;
        if (rule.conditionOperator === "equals" && fieldValue === rule.conditionValue) isMatch = true;
        if (rule.conditionOperator === "contains" && fieldValue.toLowerCase().includes(String(rule.conditionValue).toLowerCase())) isMatch = true;
        if (isMatch) {
          if (rule.actionSeverity) severity = rule.actionSeverity;
          if (rule.actionTeam) assignedTeam = rule.actionTeam;
          break;
        }
      }

      const dedupKey = `ember-${Date.now()}`;
      const incident = await repo.createIncident({
        title,
        description: JSON.stringify(alertData),
        severity,
        assignedTeam,
        pagerdutyId: dedupKey,
      });

      await repo.addAlert({ incidentId: incident.id, source, title, payload: alertData });

      if (severity === "sev1") {
        try {
          const { triggerPagerDutyIncident } = await import("./src/lib/pagerduty.ts");
          await triggerPagerDutyIncident(title, "Triggered via Ember", dedupKey);
        } catch (err) {
          console.warn("PagerDuty notify skipped", err);
        }
      }
      try {
        const { notifySlack } = await import("./src/lib/slack.ts");
        await notifySlack(`🚨 *New Incident:* ${title} (${severity}) assigned to ${assignedTeam}`);
      } catch (err) {
        console.warn("Slack notify skipped", err);
      }

      res.status(200).json({ success: true, incidentId: incident.id });
    } catch (e: any) {
      console.error("Alert Ingestion Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/incidents/:id/view", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const dbUser = req.dbUser;
      if (!dbUser || !id) return res.status(400).json({ error: "Invalid request" });

      let viewers = incidentViewers.get(id) || [];
      viewers = viewers.filter((v) => v.userId !== dbUser.id && Date.now() - v.lastSeen < 15000);
      viewers.push({
        userId: dbUser.id,
        name: dbUser.name || req.user?.name || "",
        email: dbUser.email || req.user?.email || "",
        lastSeen: Date.now(),
      });
      incidentViewers.set(id, viewers);
      res.json(viewers.filter((v) => v.userId !== dbUser.id));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/incidents/bulk", requireAuth, async (req: AuthRequest, res) => {
    try {
      const incidentIds: number[] = req.body.incidentIds || req.body.ids;
      const action = req.body.action;
      if (!incidentIds?.length || !action) return res.status(400).json({ error: "Invalid request" });

      const newStatus = action === "resolve" ? "resolved" : "investigating";

      for (const id of incidentIds) {
        const patch: Record<string, any> = { status: newStatus };
        if (action === "resolve") patch.resolvedAt = new Date();
        const inc = await repo.updateIncident(id, patch);
        if (action === "resolve" && inc?.pagerdutyId) {
          try {
            const { resolvePagerDutyIncident } = await import("./src/lib/pagerduty.ts");
            await resolvePagerDutyIncident(inc.pagerdutyId);
          } catch (err) {
            console.warn("PagerDuty resolve skipped", err);
          }
        }
      }

      try {
        const { notifySlack } = await import("./src/lib/slack.ts");
        await notifySlack(`✅ Bulk action '${action}' applied to ${incidentIds.length} incidents by ${req.user?.email}`);
      } catch {}

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/rca-templates", requireAuth, async (_req, res) => {
    try {
      res.json(await repo.listRcaTemplates());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/incidents/:id/jira", requireAuth, async (req: AuthRequest, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const incident = await repo.getIncident(incidentId);
      if (!incident) return res.status(404).json({ error: "Incident not found" });

      const { createJiraIssue } = await import("./src/lib/jira.ts");
      const jiraKey = await createJiraIssue(`[Ember] ${incident.title}`, `Severity: ${incident.severity}\n\n${incident.description}`);

      if (jiraKey) {
        await repo.addAudit({ incidentId, userId: req.dbUser?.id, action: `Linked Jira ${jiraKey}`, details: { jiraKey } });
        res.json({ success: true, jiraKey });
      } else {
        res.status(200).json({
          success: false,
          message: "Jira is not configured. Set JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY.",
        });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/incidents", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, description, severity } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
      const newIncident = await repo.createIncident({ title, description, severity });
      await repo.addAudit({
        incidentId: newIncident.id,
        userId: req.dbUser?.id,
        action: "Manual Incident Created",
        details: { title, severity },
      });
      res.json(newIncident);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/incidents", requireAuth, async (_req, res) => {
    try {
      res.json(await repo.listIncidents());
    } catch (error) {
      console.error("Failed to fetch incidents:", error);
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  app.get("/api/users", requireAuth, async (_req, res) => {
    try {
      res.json(await repo.listUsers());
    } catch {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/incidents/:id/assign", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const assigneeId = req.body.assigneeId ? parseInt(req.body.assigneeId) : null;
      await repo.updateIncident(id, { assigneeId });
      const assignee = assigneeId ? await repo.getUserById(assigneeId) : null;
      await repo.addAudit({
        incidentId: id,
        userId: req.dbUser?.id,
        action: "Reassigned Incident",
        details: { assignee: assignee?.name || assignee?.email || "Unassigned" },
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/incidents/:id/comments", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { content } = req.body;
      if (!req.dbUser) return res.status(403).json({ error: "User not found" });
      if (!content?.trim()) return res.status(400).json({ error: "Comment cannot be empty" });
      const comment = await repo.addComment({ incidentId: id, userId: req.dbUser.id, content: content.trim() });
      res.json({ ...comment, user: req.dbUser });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/incidents/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const incident = await repo.getIncident(id);
      if (!incident) {
        res.status(404).json({ error: "Incident not found" });
        return;
      }
      const assignee = incident.assigneeId ? await repo.getUserById(incident.assigneeId) : null;
      res.json({
        ...incident,
        assignee,
        alerts: await repo.listAlerts(id),
        rootCauses: await repo.listRootCauses(id),
        remediationActions: await repo.listActions(id),
        auditLogs: await repo.listLogs(id),
        comments: await repo.listComments(id),
      });
    } catch (error) {
      console.error("Failed to fetch incident details:", error);
      res.status(500).json({ error: "Failed to fetch incident details" });
    }
  });

  const applyActionDecision = async (req: AuthRequest, res: express.Response, actionId: number, decision: "approve" | "reject") => {
    if (!req.dbUser) {
      res.status(403).json({ error: "User not found in DB" });
      return;
    }
    const patch =
      decision === "approve"
        ? { status: "approved", approvedBy: req.dbUser.id, approvedAt: new Date() }
        : { status: "rejected" };
    const action = await repo.updateAction(actionId, patch);
    if (!action) {
      res.status(404).json({ error: "Action not found" });
      return;
    }
    await repo.addAudit({
      incidentId: action.incidentId,
      userId: req.dbUser.id,
      action: decision === "approve" ? "approved_remediation" : "rejected_remediation",
      details: { actionId, type: action.actionType },
    });
    res.json(action);
  };

  app.post("/api/actions/:id/approve", requireAuth, async (req: AuthRequest, res) => {
    try {
      await applyActionDecision(req, res, parseInt(req.params.id), "approve");
    } catch (error) {
      console.error("Failed to approve action:", error);
      res.status(500).json({ error: "Failed to approve action" });
    }
  });

  app.post("/api/actions/:id/reject", requireAuth, async (req: AuthRequest, res) => {
    try {
      await applyActionDecision(req, res, parseInt(req.params.id), "reject");
    } catch (error) {
      console.error("Failed to reject action:", error);
      res.status(500).json({ error: "Failed to reject action" });
    }
  });

  app.post("/api/incidents/:id/actions/:actionId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const decision = req.body.action === "reject" ? "reject" : "approve";
      await applyActionDecision(req, res, parseInt(req.params.actionId), decision);
    } catch (error) {
      res.status(500).json({ error: "Failed to update action" });
    }
  });

  app.post("/api/incidents/:id/investigate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await repo.updateIncident(id, { status: "investigating" });
      const incident = await repo.getIncident(id);
      if (!incident) {
        res.status(404).json({ error: "Incident not found" });
        return;
      }

      const { runInvestigation } = await import("./src/agent/investigation.ts");
      const result = await runInvestigation(id, incident.description || incident.title);

      if (result) {
        const rc = await repo.addRootCause({
          incidentId: id,
          hypothesis: result.hypothesis,
          evidence: result.evidence,
          confidence: result.confidence,
        });
        await repo.addAction({
          incidentId: id,
          description: result.remediationDescription,
          actionType: result.actionType,
          actionPayload: result.actionPayload,
          status: "proposed",
        });
        await repo.updateIncident(id, { status: "pending_approval", rootCauseId: rc.id });
        await repo.addAudit({
          incidentId: id,
          userId: req.dbUser?.id,
          action: "AI investigation completed",
          details: { confidence: result.confidence },
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to run investigation:", error);
      res.status(500).json({ error: "Failed to run investigation" });
    }
  });

  app.post("/api/incidents/:id/tags", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { tags } = req.body;
      if (!Array.isArray(tags)) return res.status(400).json({ error: "Tags must be an array" });
      await repo.updateIncident(id, { tags });
      await repo.addAudit({
        incidentId: id,
        userId: req.dbUser?.id,
        action: "Updated Incident Tags",
        details: { tags },
      });
      res.json({ success: true, tags });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer as createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/auth")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

async function startLocal() {
  const app = await createApp();
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Ember running on http://0.0.0.0:${PORT} (${isMemoryMode() ? "demo memory store" : "postgres"})`);
  });
}

if (!process.env.VERCEL) {
  startLocal();
}

export default async function handler(req: any, res: any) {
  const app = await createApp();
  return app(req, res);
}
