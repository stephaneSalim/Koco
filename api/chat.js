const MAX_TOKENS_BY_MODE = {
  freeChat: 600,
  speak:    600,
  mission:  800,
  daily_life: 500,
  debate:   800,
  default:  600,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mode = req.body.mode || 'default';
  const max_tokens = MAX_TOKENS_BY_MODE[mode] || MAX_TOKENS_BY_MODE.default;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens,
      system: req.body.system,
      messages: req.body.messages
    })
  });

  const data = await response.json();
  res.status(response.status).json({
    ...data,
    _model_used: 'claude-sonnet-4-6',
    _mode: mode,
    _max_tokens: max_tokens,
  });
}
