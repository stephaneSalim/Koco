export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId requis' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const [painPointsRes, lessonUnitsRes, sessionsRes, allReviewRes] = await Promise.all([
    supabase
      .from('review_items')
      .select('original, fixed, note, interval_days, unit_id')
      .eq('user_id', userId)
      .order('interval_days', { ascending: true })
      .limit(5),

    supabase
      .from('lesson_content')
      .select('unit_id, theme, category, vocabulary, structures, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(10),

    supabase
      .from('sessions')
      .select('lesson_id')
      .eq('user_id', userId),

    supabase
      .from('review_items')
      .select('note, interval_days')
      .eq('user_id', userId)
      .order('interval_days', { ascending: true })
      .limit(20)
  ]);

  const sessionCounts = {};
  for (const s of (sessionsRes.data || [])) {
    if (s.lesson_id) sessionCounts[s.lesson_id] = (sessionCounts[s.lesson_id] || 0) + 1;
  }

  const units = (lessonUnitsRes.data || []).map(u => {
    const sessionCount = sessionCounts[u.unit_id] || 0;
    const mastery = Math.min(100, sessionCount * 10 + (u.vocabulary?.length || 0) / 2 + (u.structures?.length || 0));
    return {
      unit_id: u.unit_id,
      theme: u.theme || '',
      category: u.category || '',
      vocab_count: (u.vocabulary || []).length,
      structure_count: (u.structures || []).length,
      session_count: sessionCount,
      mastery: Math.round(mastery)
    };
  });

  const errorTypes = {};
  for (const item of (allReviewRes.data || [])) {
    if (item.note) {
      const key = item.note.slice(0, 60);
      errorTypes[key] = (errorTypes[key] || 0) + 1;
    }
  }

  const topErrors = Object.entries(errorTypes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([note, count]) => ({ note, count }));

  return res.json({
    success: true,
    snapshot: {
      units,
      painPoints: painPointsRes.data || [],
      topErrors,
      generatedAt: new Date().toISOString()
    }
  });
}
