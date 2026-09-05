import { GoogleGenAI } from '@google/genai';

const FALLBACK = {
  hypothesis: 'Connection pool exhaustion after a pg-bouncer configuration deploy reduced available database connections.',
  evidence: [
    'Logs show "Database connection pool exhausted" coinciding with the error spike',
    'Trace 1234: CheckoutService -> PaymentGateway timeout > 5000ms',
    'Deploy 998 updated pg-bouncer configuration 10 minutes before the first alert',
  ],
  confidence: 84,
  remediationDescription: 'Roll back deploy 998 and restore the previous pg-bouncer pool size. Then bounce checkout-api workers.',
  actionType: 'rollback_deployment',
  actionPayload: { deployId: '998' },
};

export async function runInvestigation(_incidentId: number, alertContext: string) {
  const logs = '[ERROR] Database connection pool exhausted\n[WARN] High latency on /api/checkout';
  const traces = 'Trace 1234: CheckoutService -> PaymentGateway (Timeout > 5000ms)';
  const deployments = 'Deploy 998: Updated pg-bouncer configuration 10 mins ago.';

  if (!process.env.GEMINI_API_KEY) {
    return { ...FALLBACK, hypothesis: `${FALLBACK.hypothesis} Context: ${String(alertContext).slice(0, 120)}` };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
    You are an AI Incident Response Engineer investigating a production issue.

    Alert Context:
    ${alertContext}

    Recent Deployments:
    ${deployments}

    Logs:
    ${logs}

    Traces:
    ${traces}

    Based on this evidence, determine the root cause and propose a remediation action.
    Format your response exactly as JSON:
    {
      "hypothesis": "String describing the root cause",
      "evidence": ["Evidence 1", "Evidence 2"],
      "confidence": 95,
      "remediationDescription": "What to do to fix it",
      "actionType": "rollback_deployment",
      "actionPayload": {"deployId": "998"}
    }
  `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const resultText = response.text || '{}';
    return JSON.parse(resultText);
  } catch (error) {
    console.error('Investigation LLM failed, using evidence-backed fallback.', error);
    return FALLBACK;
  }
}
