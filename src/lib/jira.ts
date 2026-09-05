export async function createJiraIssue(title: string, description: string) {
  const domain = process.env.JIRA_DOMAIN;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  if (!domain || !email || !apiToken || !projectKey) {
    console.warn("Jira credentials not fully configured. Skipping Jira issue creation.");
    return null;
  }

  try {
    const response = await fetch(`https://${domain}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: title,
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: description }]
              }
            ]
          },
          issuetype: { name: "Bug" } // Adjust if using a different issue type
        }
      })
    });
    
    if (response.ok) {
       const data = await response.json();
       return data.key; // Returns something like PROJ-123
    } else {
       console.error("Jira API Error", await response.text());
       return null;
    }
  } catch (err) {
    console.error("Jira Integration Error:", err);
    return null;
  }
}
