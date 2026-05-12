// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcript, opportunityName, opportunityAddress } = req.body as {
    transcript?: string;
    opportunityName?: string;
    opportunityAddress?: string;
  };

  if (!transcript?.trim()) return res.status(400).json({ error: 'transcript required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const systemPrompt = `You are a construction site documentation assistant for Harris Excavation. Format the voice transcript into a clean markdown site note.

Use this exact top-level header: ## Site Visit — ${dateStr} at ${timeStr}

Then include ONLY sections that have relevant content, using exactly these section names:
### Site Conditions
### Access
### Existing Utilities
### Scope Observations
### Concerns
### Next Steps

Rules:
- Preserve all specific numbers, distances, measurements, and proper nouns exactly as stated.
- Use bullet points within each section.
- Omit any section that has no relevant content.
- Write in professional, concise construction industry language.
- Do not add information not present in the transcript.`;

  const userMessage = [
    `Site: ${opportunityName ?? 'Unknown'}`,
    opportunityAddress ? `Address: ${opportunityAddress}` : null,
    '',
    'Voice transcript:',
    transcript.trim(),
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('[format-note] Anthropic error', r.status, errText);
      return res.status(500).json({ error: 'Anthropic API error', detail: errText });
    }

    const data = await r.json() as { content: Array<{ type: string; text?: string }> };
    const markdown = data.content.find((b) => b.type === 'text')?.text ?? '';
    return res.status(200).json({ markdown });
  } catch (err) {
    console.error('[format-note]', err);
    return res.status(500).json({ error: 'Format note failed', detail: String(err) });
  }
}
