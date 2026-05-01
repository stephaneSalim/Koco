function buildCachedSystem(fullSystem) {
  if (!fullSystem || typeof fullSystem !== 'string') return fullSystem;

  const dynamicMarker = 'ERREURS RÉCURRENTES';
  const dynamicIdx = fullSystem.indexOf(dynamicMarker);

  if (dynamicIdx === -1) {
    return [{ type: 'text', text: fullSystem, cache_control: { type: 'ephemeral' } }];
  }

  return [
    { type: 'text', text: fullSystem.slice(0, dynamicIdx), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: fullSystem.slice(dynamicIdx) },
  ];
}

function getMaxTokens(mode) {
  const limits = { mission: 800, debate: 800, speak: 600, freeChat: 600, daily_life: 500, default: 600 };
  return limits[mode] || limits.default;
}

function selectModel(mode, userMessageLength, hasRecurringErrors) {
  if (
    mode === 'mission' ||
    mode === 'debate' ||
    userMessageLength > 200 ||
    hasRecurringErrors === true
  ) {
    return 'claude-sonnet-4-6';
  }
  return 'claude-haiku-4-5-20251001';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, system, mode, userMessageLength, hasRecurringErrors } = req.body;

  const selectedModel = selectModel(mode, userMessageLength, hasRecurringErrors);
  const max_tokens = getMaxTokens(mode);
  const windowedMessages = (messages || []).slice(-8);
  const systemParts = buildCachedSystem(system);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({ model: selectedModel, max_tokens, system: systemParts, messages: windowedMessages }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Anthropic error:', JSON.stringify(data));
    return res.status(response.status).json(data);
  }

  const usage = data.usage;
  if (usage) {
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    console.log('Token usage:', {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cache_read: cacheRead,
      cache_write: cacheWrite,
      model: selectedModel,
      mode: mode,
    });
    if (cacheRead > 0) console.log('Cache hit! Saved ~', cacheRead, 'tokens');
  }

  return res.json({
    ...data,
    _model_used: selectedModel,
    _mode: mode,
    _cached: (usage?.cache_read_input_tokens || 0) > 0,
    _tokens: {
      input: usage?.input_tokens,
      output: usage?.output_tokens,
      cache_read: usage?.cache_read_input_tokens || 0,
      cache_write: usage?.cache_creation_input_tokens || 0,
    },
  });
}
