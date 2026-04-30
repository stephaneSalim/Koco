export default async function handler(req, res) {
  const { images, unitId, userId } = req.body;

  if (!unitId || !userId || !images?.length) {
    return res.status(400).json({
      error: 'unitId, userId et images requis'
    });
  }

  const prompt = `Tu es un agent ETL de haute précision spécialisé en coréen académique TOPIK 5-6.
Analyse ces ${images.length} page(s) de manuel SNU.

RÈGLES ABSOLUES :
1. Extrais les mots EXACTS du texte — zéro paraphrase, zéro synonyme
2. Si un mot est illisible → champ "ambiguous", jamais d'invention
3. Distingue texte imprimé (manuel) vs annotations manuscrites
4. Maximum 30 vocab, 15 structures par page

SORTIE : JSON pur sans backticks.
{
  "printed_content": {
    "vocabulary": ["mot_exact_1", "mot_exact_2"],
    "structures": ["-기 마련이다", "-(으)ㄹ수록"],
    "context_snippets": ["phrase exacte visible sur la page"]
  },
  "handwritten_notes": {
    "personal_annotations": ["note manuscrite exacte"],
    "corrections": ["correction manuscrite"],
    "mnemonics": ["moyen mémo personnel"]
  },
  "ocr_confidence": 0.85,
  "ambiguous": ["élément illisible ou incertain"]
}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://kocoo.vercel.app',
      'X-Title': 'KoCo SNU OCR'
    },
    body: JSON.stringify({
      model: 'google/gemini-pro-1.5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map(img => ({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${img}` }
          }))
        ]
      }]
    })
  });

  const geminiData = await response.json();
  const rawText = geminiData.choices?.[0]?.message?.content || '';

  function parseGeminiOCR(rawText) {
    const clean = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      const vocabMatch = clean.match(/"vocabulary"\s*:\s*(\[.*?\])/s);
      const structMatch = clean.match(/"structures"\s*:\s*(\[.*?\])/s);
      parsed = {
        printed_content: {
          vocabulary: vocabMatch ? JSON.parse(vocabMatch[1]) : [],
          structures: structMatch ? JSON.parse(structMatch[1]) : []
        },
        handwritten_notes: { personal_annotations: [] },
        ocr_confidence: 0.3,
        parse_error: true
      };
    }

    const confidence = parsed?.ocr_confidence || 0.5;

    return {
      printed_content: {
        vocabulary: parsed?.printed_content?.vocabulary || [],
        structures: parsed?.printed_content?.structures || [],
        context_snippets: parsed?.printed_content?.context_snippets || []
      },
      handwritten_notes: {
        personal_annotations: parsed?.handwritten_notes?.personal_annotations || [],
        corrections: parsed?.handwritten_notes?.corrections || [],
        mnemonics: parsed?.handwritten_notes?.mnemonics || []
      },
      ocr_confidence: confidence,
      ambiguous: parsed?.ambiguous || [],
      parse_error: parsed?.parse_error || false,
      quality_flag: confidence < 0.6 ? 'REVIEW_REQUIRED' : 'AUTO_APPROVE'
    };
  }

  const parsed = parseGeminiOCR(rawText);

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data: staging, error } = await supabase
    .from('lesson_content_staging')
    .insert({
      user_id: userId,
      unit_id: unitId,
      raw_gemini_output: { raw: rawText },
      printed_vocab: parsed.printed_content.vocabulary,
      printed_structures: parsed.printed_content.structures,
      printed_snippets: parsed.printed_content.context_snippets,
      handwritten_notes: [
        ...parsed.handwritten_notes.personal_annotations,
        ...parsed.handwritten_notes.corrections,
        ...parsed.handwritten_notes.mnemonics
      ],
      ambiguous: parsed.ambiguous,
      ocr_confidence: parsed.ocr_confidence,
      quality_flag: parsed.quality_flag,
      parse_error: parsed.parse_error,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error('Staging insert error:', JSON.stringify(error));
    return res.status(500).json({ error: JSON.stringify(error) });
  }

  res.json({
    success: true,
    staging_id: staging.id,
    quality_flag: parsed.quality_flag,
    stats: {
      vocab: parsed.printed_content.vocabulary.length,
      structures: parsed.printed_content.structures.length,
      snippets: parsed.printed_content.context_snippets.length,
      handwritten: parsed.handwritten_notes.personal_annotations.length,
      ambiguous: parsed.ambiguous.length,
      confidence: parsed.ocr_confidence
    }
  });
}
