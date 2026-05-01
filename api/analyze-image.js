export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const imageData = req.body.image || req.body.imageBase64;
  const { unitId } = req.body;
  const userId = req.body.userId || req.body.user_id;

  console.log('Image received:', {
    hasImage: !!imageData,
    imageLength: imageData?.length,
    unitId,
    userId: !!userId,
    bodyKeys: Object.keys(req.body),
  });

  if (!imageData) {
    return res.status(400).json({
      error: 'image required',
      received_keys: Object.keys(req.body),
    });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  if (!unitId) {
    return res.status(400).json({ error: "unitId manquant — requis pour l'extraction" });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Pre-check : seuil de saturation uniquement (accumulation active en dessous)
  const { data: existing } = await supabase
    .from('lesson_content')
    .select('vocabulary, structures, context_snippets, domain_tags, ocr_confidence, updated_at')
    .eq('unit_id', unitId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing && (existing.vocabulary?.length || 0) >= 300) {
    console.log('Unit saturated (300+ words):', unitId,
      '| vocab:', existing.vocabulary?.length
    );
    return res.json({
      alreadyExists: true,
      saturated: true,
      unit_id: unitId,
      stats: {
        vocab: existing.vocabulary?.length,
        structures: existing.structures?.length,
        confidence: existing.ocr_confidence,
        last_updated: existing.updated_at,
      },
    });
  }

  console.log('New unit or insufficient data — proceeding with Claude Vision');
  console.log('ETL start | unitId:', unitId, '| image length:', imageData?.length);

  const ETL_PROMPT = `Tu es un agent ETL de haute précision.
Extrais le contenu de cette image de cours de coréen.

RÈGLES ABSOLUES :
1. unit_id : Utilise UNIQUEMENT "${unitId}" — ne devine jamais
2. context_snippets : Uniquement phrases DISTINCTEMENT visibles
   Si zone floue ou incertaine → OMISSION, jamais d'invention
3. category : Choisis UNIQUEMENT parmi cette liste fermée :
   Académique | Technique | Vie_Quotidienne | Économie | Culture | Histoire | Science | Médias | Travail | Environnement

EXTRACTION :
- theme : "[KO] Titre coréen | [FR] Traduction" (max 100 chars)
- vocabulary : Noms/Verbes/Adjectifs uniquement, max 30 items. Pas de particules, pas de phrases
- structures : Points de grammaire purs, max 15 items. Format : -기 마련이다, -(으)ㄹ수록
- ocr_confidence : 0.0 à 1.0 (1.0 = parfaitement lisible, 0.5 = partiellement lisible, 0.0 = illisible)

SORTIE : JSON pur, sans backticks, sans texte explicatif.
{
  "unit_id": "${unitId}",
  "theme": "[KO] ... | [FR] ...",
  "category": "Culture",
  "vocabulary": ["mot1", "mot2"],
  "structures": ["-기 마련이다"],
  "context_snippets": ["phrase exacte de l image"],
  "ocr_confidence": 0.85
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
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageData }
          },
          { type: 'text', text: ETL_PROMPT }
        ]
      }]
    })
  });

  const data = await response.json();
  console.log('Claude Vision status:', response.status);
  if (data.error) console.error('Claude Vision error:', JSON.stringify(data.error));

  console.log('Claude response structure:', JSON.stringify({
    type: data.type,
    content_length: data.content?.length,
    first_content_type: data.content?.[0]?.type,
    text_preview: data.content?.[0]?.text?.slice(0, 100),
  }));

  const rawText = data.content?.[0]?.text;
  console.log('Raw text defined:', !!rawText);
  console.log('Raw text preview:', rawText?.slice(0, 200));

  if (!rawText) {
    return res.status(422).json({
      error: 'Claude returned no text',
      response_type: data.type,
      stop_reason: data.stop_reason,
    });
  }

  try {
    const raw = rawText.trim();
    const json = raw.startsWith('{') ? raw : raw.match(/\{[\s\S]*\}/)?.[0];
    const extracted = JSON.parse(json);
    extracted.unit_id = unitId;

    const mergedVocab = [...new Set([
      ...(existing?.vocabulary || []),
      ...(extracted.vocabulary || []),
    ])];
    const mergedStructures = [...new Set([
      ...(existing?.structures || []),
      ...(extracted.structures || []),
    ])];
    const mergedSnippets = [...new Set([
      ...(existing?.context_snippets || []),
      ...(extracted.context_snippets || []),
    ])];
    const mergedTags = [...new Set([
      ...(existing?.domain_tags || []),
      ...(extracted.domain_tags || []),
    ])];

    console.log('Cumulative merge:', {
      vocab_before: existing?.vocabulary?.length || 0,
      vocab_after: mergedVocab.length,
      structures_before: existing?.structures?.length || 0,
      structures_after: mergedStructures.length,
      new_additions: mergedVocab.length - (existing?.vocabulary?.length || 0),
    });

    const { error: saveError } = await supabase
      .from('lesson_content')
      .upsert({
        unit_id: unitId,
        user_id: userId,
        theme: extracted.theme,
        category: extracted.category,
        vocabulary: mergedVocab,
        structures: mergedStructures,
        context_snippets: mergedSnippets,
        domain_tags: mergedTags,
        ocr_confidence: extracted.ocr_confidence,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'unit_id,user_id', ignoreDuplicates: false });

    if (saveError) {
      console.error('Save error:', JSON.stringify(saveError));
    } else {
      console.log('Saved:', unitId,
        '| vocab:', mergedVocab.length,
        '| structures:', mergedStructures.length
      );
    }

    res.json(extracted);
  } catch (e) {
    console.error('ETL parse error:', e.message);
    res.json({
      unit_id: unitId,
      theme: '',
      category: 'Académique',
      vocabulary: [],
      structures: [],
      context_snippets: [],
      ocr_confidence: 0.0
    });
  }
}
