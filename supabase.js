// KoCo — Supabase DB (sans auth)
const SUPABASE_URL = 'https://jxbqlphxsgglrlznpall.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZrgImoU54nnrdQnxKboadg_0AFHj1cN';

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// User ID local persistant — pas de login nécessaire
function getOrCreateUserId() {
  let userId = localStorage.getItem('koco_user_id');
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('koco_user_id', userId);
  }
  return userId;
}
window.kocoUserId = getOrCreateUserId();

async function saveCorrection(originalText, correctedText, explanation) {
  try {
    await window.supabaseClient.from('corrections').insert({
      user_id: window.kocoUserId,
      original_text: originalText,
      corrected_text: correctedText,
      error_type: explanation,
      created_at: new Date().toISOString()
    });
  } catch(e) { console.log('Correction save error:', e); }
}
window.saveCorrection = saveCorrection;

// Sauvegarder une session dans Supabase
async function getGMSSentences(snuUnit, limit = 20) {
  try {
    console.log('Fetching GMS for unit:', snuUnit);
    console.log('Supabase client:', !!window.supabaseClient);

    const { data, error, status, statusText } = await window.supabaseClient
      .from('gms_sentences')
      .select('gms_id, text_kr, text_en')
      .eq('snu_unit', snuUnit)
      .order('gms_id')
      .limit(limit);

    console.log('GMS response status:', status, statusText);
    console.log('GMS error:', error);
    console.log('GMS data count:', data?.length);

    if (error) throw error;
    return data || [];
  } catch(e) {
    console.log('GMS load error:', e);
    return [];
  }
}
window.getGMSSentences = getGMSSentences;

async function saveSession(unitId, mode, durationMinutes, corrections) {
  try {
    const sessionPayload = {
      user_id: window.kocoUserId,
      lesson_id: unitId,
      mode: mode,
      duration_seconds: durationMinutes * 60,
      created_at: new Date().toISOString()
    };
    console.log('saveSession payload:', JSON.stringify(sessionPayload));

    const { error: sessionError } = await window.supabaseClient
      .from('sessions').insert(sessionPayload);
    console.log('saveSession error:', JSON.stringify(sessionError));

    console.log('saveCorrections count:', corrections?.length);
    if (corrections && corrections.length > 0) {
      const correctionRows = corrections.map(c => ({
        user_id: window.kocoUserId,
        original_text: c.original,
        corrected_text: c.fixed,
        error_type: c.note,
        created_at: new Date().toISOString()
      }));
      const { error: corrError } = await window.supabaseClient
        .from('corrections').insert(correctionRows);
      console.log('saveCorrections error:', JSON.stringify(corrError));
    }
  } catch(e) {
    console.log('Session save error:', e);
  }
}
window.saveSession = saveSession;

async function loadUserStats() {
  try {
    const userId = window.kocoUserId;

    const { data: sessions, error: sessErr } = await window.supabaseClient
      .from('sessions')
      .select('duration_seconds, created_at, lesson_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    console.log('Sessions found:', sessions?.length, sessErr || '');

    const { data: corrections, error: corrErr } = await window.supabaseClient
      .from('corrections')
      .select('original_text, corrected_text, error_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('Corrections found:', corrections?.length, corrErr || '');

    const sessionDates = [...new Set(
      (sessions || []).map(s => new Date(s.created_at).toDateString())
    )];

    let streak = 0;
    const checkDate = new Date();
    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toDateString();
      if (sessionDates.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const totalMinutes = Math.round(
      (sessions || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60
    );

    const studiedUnits = [...new Set(
      (sessions || []).map(s => s.lesson_id).filter(Boolean)
    )];

    return {
      streak,
      totalMinutes,
      totalSessions: (sessions || []).length,
      totalCorrections: (corrections || []).length,
      recentCorrections: (corrections || []).slice(0, 5),
      studiedUnits
    };
  } catch(e) {
    console.log('Stats load error:', e);
    return null;
  }
}
window.loadUserStats = loadUserStats;

async function saveLessonContent(unitId, content) {
  const { error } = await window.supabaseClient
    .from('lesson_content')
    .upsert({
      unit_id: unitId,
      user_id: window.kocoUserId,
      vocabulary: content.vocabulary || [],
      structures: content.structures || [],
      theme: content.theme || '',
      level: content.level || '',
      conversation_starters: content.conversation_starters || [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'unit_id,user_id', ignoreDuplicates: false });

  if (error) {
    console.error('saveLessonContent error:', JSON.stringify(error));
  } else {
    console.log('Content saved for unit:', unitId);
  }
}

async function getLessonContent(unitId) {
  const { data, error } = await window.supabaseClient
    .from('lesson_content')
    .select('*')
    .eq('unit_id', unitId)
    .eq('user_id', window.kocoUserId)
    .maybeSingle();

  if (error) console.log('getLessonContent error:', error.message);
  return data || null;
}

window.saveLessonContent = saveLessonContent;
window.getLessonContent = getLessonContent;

async function saveMissionMetrics(score, unitId, missionOverride) {
  const { error } = await window.supabaseClient
    .from('session_metrics')
    .insert({
      user_id: window.kocoUserId,
      unit_id: unitId || '',
      mission_score: score.score_numeric / 10,
      complexity_index: score.complexity_index / 10,
      target_grammar_used: score.structures_used,
      forbidden_patterns_used: score.forbidden_detected,
      mission_constraints: JSON.stringify(
        missionOverride
        || window.MISSIONS_CONFIG?.[unitId]
        || window.MISSIONS_CONFIG?.['default']
        || {}
      ),
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('saveMissionMetrics error:', JSON.stringify(error));
  } else {
    console.log('Mission metrics saved | score:', score.score_numeric, '| complexity:', score.complexity_index);
  }
}
window.saveMissionMetrics = saveMissionMetrics;

async function saveReviewItems(userId, unitId, drills) {
  if (!drills || drills.length === 0) return;

  const now = new Date().toISOString();
  const items = drills.map(drill => ({
    user_id: userId,
    unit_id: unitId,
    original: drill.source_original,
    fixed: drill.source_fixed,
    note: drill.source_note,
    drill_recognition: JSON.stringify(drill.recognition),
    drill_recall: JSON.stringify(drill.recall),
    drill_production: JSON.stringify(drill.production),
    drills_generated_at: now,
    next_review_at: now,
    interval_days: 1
  }));

  const { error } = await window.supabaseClient
    .from('review_items')
    .insert(items);

  if (error) {
    console.error('saveReviewItems error:', JSON.stringify(error));
  } else {
    console.log('Review items saved:', items.length);
  }
}
window.saveReviewItems = saveReviewItems;

async function getDueReviewItems(userId) {
  const { data, error } = await window.supabaseClient
    .from('review_items')
    .select('*')
    .eq('user_id', userId)
    .lte('next_review_at', new Date().toISOString())
    .order('next_review_at')
    .limit(10);

  if (error) {
    console.error('getDueReviewItems error:', JSON.stringify(error));
  }
  return data || [];
}
window.getDueReviewItems = getDueReviewItems;

async function updateReviewItem(itemId, grade) {
  const { data, error: fetchError } = await window.supabaseClient
    .from('review_items')
    .select('interval_days')
    .eq('id', itemId)
    .maybeSingle();

  if (fetchError || !data) return;

  let interval = data.interval_days || 1;
  let nextReview;

  if (grade === 'easy') {
    interval = Math.min(interval * 2, 60);
    nextReview = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();
  } else if (grade === 'hard') {
    interval = 1;
    nextReview = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  } else {
    interval = 1;
    nextReview = new Date().toISOString();
  }

  const { error } = await window.supabaseClient
    .from('review_items')
    .update({ interval_days: interval, next_review_at: nextReview })
    .eq('id', itemId);

  if (error) console.error('updateReviewItem error:', JSON.stringify(error));
}
window.updateReviewItem = updateReviewItem;

async function getWeakPoints(userId, limit = 3) {
  const { data, error } = await window.supabaseClient
    .from('review_items')
    .select('original, fixed, note, interval_days')
    .eq('user_id', userId)
    .order('interval_days', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('getWeakPoints error:', JSON.stringify(error));
    return [];
  }

  console.log('Weak points fetched:', data?.length,
    '| lowest interval_days:', data?.[0]?.interval_days);
  return data || [];
}
window.getWeakPoints = getWeakPoints;

async function getLessonConstraints(unitId) {
  const { data, error } = await window.supabaseClient
    .from('lesson_content')
    .select('vocabulary, structures, theme, level')
    .eq('unit_id', unitId)
    .eq('user_id', window.kocoUserId)
    .maybeSingle();

  if (error) {
    console.error('getLessonConstraints error:', JSON.stringify(error));
    return null;
  }

  return data || null;
}
window.getLessonConstraints = getLessonConstraints;

async function getAllSNUUnits() {
  const { data, error } = await window.supabaseClient
    .from('snu_units')
    .select('*, grand_themes(label_fr, label_ko)')
    .order('level')
    .order('unit_number')
    .order('lesson_number');
  if (error) console.error('getAllSNUUnits error:', JSON.stringify(error));
  return data || [];
}
window.getAllSNUUnits = getAllSNUUnits;

async function getSNUUnit(level, unitNumber, lessonNumber) {
  const id = `snu_${level.toLowerCase()}_${unitNumber}_${lessonNumber}`;
  const { data, error } = await window.supabaseClient
    .from('snu_units')
    .select('*, grand_themes(label_fr, label_ko)')
    .eq('id', id)
    .maybeSingle();
  if (error) console.error('getSNUUnit error:', JSON.stringify(error));
  return data || null;
}
window.getSNUUnit = getSNUUnit;

async function getDataHealth(unitId) {
  const { data, error } = await window.supabaseClient
    .from('lesson_content')
    .select('vocabulary, structures, theme')
    .eq('unit_id', unitId)
    .eq('user_id', window.kocoUserId)
    .maybeSingle();

  if (error || !data) {
    return { status: 'red', wordCount: 0, label: 'Vide', color: '#e53935', dot: '🔴' };
  }

  const vocabCount = (data.vocabulary || []).length;
  const structuresCount = (data.structures || []).length;
  const themeWords = (data.theme || '').split(' ').length;
  const wordCount = (vocabCount * 5) + (structuresCount * 8) + themeWords;

  let status, label, color, dot;
  if (wordCount < 100) {
    status = 'red'; label = wordCount === 0 ? 'Vide' : 'Insuffisant'; color = '#e53935'; dot = '🔴';
  } else if (wordCount < 300) {
    status = 'orange'; label = 'Partiel'; color = '#f7931e'; dot = '🟠';
  } else {
    status = 'green'; label = 'Optimal'; color = '#00a884'; dot = '🟢';
  }

  return { status, wordCount, label, color, dot };
}
window.getDataHealth = getDataHealth;

const healthCache = {};

async function getDataHealthCached(unitId) {
  if (healthCache[unitId]) return healthCache[unitId];
  const health = await getDataHealth(unitId);
  healthCache[unitId] = health;
  return health;
}
window.getDataHealthCached = getDataHealthCached;

function invalidateHealthCache(unitId) {
  delete healthCache[unitId];
  console.log('Health cache invalidated for:', unitId);
}
window.invalidateHealthCache = invalidateHealthCache;

async function searchGlobalContext(userId, userMessage) {
  const keywords = userMessage
    .split(/[\s,。、！？!?]+/)
    .filter(w => w.length > 2)
    .slice(0, 8);

  if (!keywords.length) return { source: 'none', data: [] };

  // Priority 1: lesson_content (user's uploaded pages)
  const { data: lessonData, error } = await window.supabaseClient
    .rpc('search_global_context', {
      user_id_input: userId,
      search_terms: keywords
    });

  if (error) console.error('searchGlobalContext error:', JSON.stringify(error));

  if (lessonData && lessonData.length > 0) {
    console.log('Global context: lesson_content', lessonData.length, 'units | keywords:', keywords);
    return { source: 'lesson_content', data: lessonData };
  }

  // Priority 2: GMS fallback
  console.log('lesson_content empty → fallback to GMS | keywords:', keywords);

  const orFilters = keywords.map(k => `text_kr.ilike.%${k}%`).join(',');

  const { data: gmsData } = await window.supabaseClient
    .from('gms_sentences')
    .select('text_kr, text_en, situation_tag, speech_level, snu_unit')
    .or(orFilters)
    .limit(10);

  return { source: 'gms', data: gmsData || [] };
}
window.searchGlobalContext = searchGlobalContext;

async function fetchHybridContext(userId, userMessage) {
  const keywords = userMessage
    .split(/[\s,。、！？!?]+/)
    .filter(w => w.length > 2)
    .slice(0, 8);

  if (!keywords.length) return { lessonData: [], gmsData: [] };

  const orFilters = keywords.map(k => `text_kr.ilike.%${k}%`).join(',');

  const [lessonResult, gmsResult] = await Promise.all([
    window.supabaseClient
      .rpc('search_global_context', {
        user_id_input: userId,
        search_terms: keywords
      }),
    window.supabaseClient
      .from('gms_sentences')
      .select('text_kr, text_en, situation_tag, speech_level, snu_unit')
      .or(orFilters)
      .limit(8)
  ]);

  const lessonData = lessonResult.data || [];
  const gmsData = gmsResult.data || [];

  console.log('Hybrid RAG:', lessonData.length, 'lesson_content |', gmsData.length, 'GMS phrases');

  return { lessonData, gmsData };
}
window.fetchHybridContext = fetchHybridContext;
