export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { missionSheet, unitTitle } = req.body;

  if (!missionSheet) {
    return res.status(400).json({ error: 'Missing missionSheet' });
  }

  const prompt = `Tu es un expert pédagogique coréen TOPIK 6.

Génère exactement 3 scénarios de discussion basés sur :
Unité : ${unitTitle || ''}
Structures cibles : ${(missionSheet.grammar || []).join(', ')}
Vocabulaire : ${(missionSheet.vocabulary || []).slice(0, 8).join(', ')}
Points faibles : ${(missionSheet.weak_points || []).map(w => w.note).filter(Boolean).join(', ') || 'aucun'}

Pour chaque scénario génère :
- Titre court (3-4 mots)
- 2 mots vocab preview
- Golden Thread 3 étapes logiques
- 2 collocations avancées natives
- Première question en coréen

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "scenarios": [
    {
      "number": 1,
      "title": "titre court",
      "vocab_preview": ["mot1", "mot2"],
      "golden_thread": [
        "1. 현황 → description courte",
        "2. 문제 → description courte",
        "3. 해결 → description courte"
      ],
      "collocations": ["nom+verbe naturel", "nom+adjectif naturel"],
      "first_question": "question en coréen pour lancer"
    }
  ]
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (e) {
    console.error('Scenarios parse error:', e.message, '| raw:', text.slice(0, 200));
    res.status(500).json({ error: 'Parse failed', raw: text });
  }
}
