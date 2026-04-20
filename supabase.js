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
