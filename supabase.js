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
    await window.supabaseClient.from('sessions').insert({
      user_id: window.kocoUserId,
      lesson_id: unitId,
      mode: mode,
      duration_seconds: durationMinutes * 60,
      created_at: new Date().toISOString()
    });

    if (corrections && corrections.length > 0) {
      const correctionRows = corrections.map(c => ({
        user_id: window.kocoUserId,
        original_text: c.original,
        corrected_text: c.fixed,
        error_type: c.note,
        created_at: new Date().toISOString()
      }));
      await window.supabaseClient.from('corrections').insert(correctionRows);
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
