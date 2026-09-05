export async function notifySlack(message: string, blocks?: any[]) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL not set. Skipping Slack notification.");
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        blocks: blocks
      })
    });
  } catch (err) {
    console.error("Slack Notification Error:", err);
  }
}
