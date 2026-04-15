// KoCo — Supabase DB (sans auth)
const SUPABASE_URL = 'https://jxbqlphxsgglrlznpall.supabase.co';
const SUPABASE_ANON_KEY = 'REMPLACE_PAR_TA_CLE_ANON';

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

// Sauvegarder une session dans Supabase
async function saveSession(lessonId, mode, durationSeconds) {
  try {
    await window.supabaseClient.from('sessions').insert({
      user_id: window.kocoUserId,
      lesson_id: lessonId,
      mode: mode,
      duration_seconds: durationSeconds,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to save session', error);
  }
}
