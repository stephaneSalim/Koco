export default async function handler(req, res) {
  const { stagingId, userId, approved_vocab, approved_structures, approved_snippets } = req.body;

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data: staging } = await supabase
    .from('lesson_content_staging')
    .select('*')
    .eq('id', stagingId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!staging) {
    return res.status(404).json({ error: 'Staging not found' });
  }

  const { data: existing } = await supabase
    .from('lesson_content')
    .select('vocabulary, structures, context_snippets')
    .eq('unit_id', staging.unit_id)
    .eq('user_id', userId)
    .maybeSingle();

  const mergedVocab = [...new Set([
    ...(existing?.vocabulary || []),
    ...(approved_vocab || staging.printed_vocab || [])
  ])];

  const mergedStructures = [...new Set([
    ...(existing?.structures || []),
    ...(approved_structures || staging.printed_structures || [])
  ])];

  const mergedSnippets = [...new Set([
    ...(existing?.context_snippets || []),
    ...(approved_snippets || staging.printed_snippets || [])
  ])];

  const { error: commitError } = await supabase
    .from('lesson_content')
    .upsert({
      unit_id: staging.unit_id,
      user_id: userId,
      vocabulary: mergedVocab,
      structures: mergedStructures,
      context_snippets: mergedSnippets,
      ocr_confidence: staging.ocr_confidence,
      updated_at: new Date().toISOString()
    }, { onConflict: 'unit_id,user_id' });

  if (commitError) {
    return res.status(500).json({ error: JSON.stringify(commitError) });
  }

  await supabase
    .from('lesson_content_staging')
    .update({
      status: 'committed',
      committed_at: new Date().toISOString()
    })
    .eq('id', stagingId);

  res.json({
    success: true,
    unit_id: staging.unit_id,
    merged: {
      vocab: mergedVocab.length,
      structures: mergedStructures.length,
      snippets: mergedSnippets.length
    }
  });
}
