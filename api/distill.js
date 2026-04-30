export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { corrections, unitId, userId } = req.body;

  if (!corrections || corrections.length === 0) {
    return res.json({ drills: [] });
  }

  const prompt = `Tu es un distillateur pédagogique coréen expert.
Analyse ces corrections de conversation coréenne et génère exactement 3 drills par correction.

CORRECTIONS :
${corrections.map((c, i) => `
${i + 1}. Original: ${c.original}
   Corrigé: ${c.fixed}
   Note: ${c.note}
`).join('\n')}

Pour chaque correction, génère un JSON avec ces 3 drills :

1. RECOGNITION : Présente la phrase erronée avec un mot/particule manquant remplacé par ___. L'utilisateur doit compléter.

2. RECALL : Donne une phrase en français à traduire en coréen en utilisant la même structure grammaticale.

3. PRODUCTION : Demande de créer une phrase originale en coréen sur le même thème en utilisant la structure cible.

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "drills": [
    {
      "source_original": "...",
      "source_fixed": "...",
      "source_note": "...",
      "recognition": {
        "instruction": "빈칸을 채우세요:",
        "prompt": "phrase avec ___ à compléter",
        "answer": "mot/particule correct"
      },
      "recall": {
        "instruction": "번역하세요:",
        "prompt": "phrase en français",
        "answer": "traduction coréenne correcte"
      },
      "production": {
        "instruction": "문장을 만드세요:",
        "prompt": "consigne de production en français",
        "target_structure": "structure grammaticale cible"
      }
    }
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'Anthropic API error', drills: [] });
    }

    const data = await response.json();
    const text = data.content[0].text;

    try {
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch {
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      return res.json(parsed);
    }
  } catch (e) {
    console.error('Distill handler error:', e);
    return res.status(500).json({ error: e.message, drills: [] });
  }
}
