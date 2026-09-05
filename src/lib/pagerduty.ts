export async function triggerPagerDutyIncident(title: string, description: string, dedupKey: string) {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) {
    console.warn("PAGERDUTY_ROUTING_KEY not set. Skipping PagerDuty trigger.");
    return null;
  }

  try {
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: 'trigger',
        dedup_key: dedupKey,
        payload: {
          summary: title,
          source: 'Ember - AI Incident Response',
          severity: 'critical',
          custom_details: { description }
        }
      })
    });
    
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("PagerDuty Trigger Error:", err);
    return null;
  }
}

export async function resolvePagerDutyIncident(dedupKey: string) {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) return;

  try {
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: 'resolve',
        dedup_key: dedupKey
      })
    });
  } catch (err) {
    console.error("PagerDuty Resolve Error:", err);
  }
}
