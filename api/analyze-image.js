export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, snuUnit } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 required' });
  }

  console.log('Image size (base64 length):', imageBase64?.length);
  console.log('Image type:', 'image/jpeg');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64
            }
          },
          {
            type: 'text',
            text: `Tu es un expert de la méthode SNU Korean.
Analyse cette page du manuel SNU (unité: ${snuUnit || 'inconnue'}).
Extrais en JSON :
{
  "vocabulary": ["mot1", "mot2"],
  "structures": ["structure1"],
  "theme": "thème principal de la page",
  "level": "3A/3B/4A/4B/5A/5B",
  "conversation_starters": ["question1", "question2", "question3"]
}
Réponds UNIQUEMENT avec le JSON, rien d'autre.`
          }
        ]
      }]
    })
  });

  const data = await response.json();

  console.log('Claude Vision status:', response.status);
  console.log('Claude Vision error:', JSON.stringify(data.error));

  try {
    const text = data.content[0].text.trim();
    const json = text.startsWith('{') ? text : text.match(/\{[\s\S]*\}/)?.[0];
    const extracted = JSON.parse(json);
    res.json(extracted);
  } catch (e) {
    res.json({
      vocabulary: [],
      structures: [],
      theme: snuUnit || '알 수 없음',
      level: '5A',
      conversation_starters: []
    });
  }
}
