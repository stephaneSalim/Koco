// api/_lib/auth.js — Authentification + quota partagés par toutes les fonctions /api
// Les fichiers préfixés par "_" ne sont pas exposés comme routes par Vercel.
//
// Principe : le front envoie le JWT Supabase de l'utilisateur connecté
// (Authorization: Bearer <access_token>). On le vérifie, puis on crée un client
// Supabase "au nom de l'utilisateur" : toutes les requêtes passent par les
// règles RLS (user_id = auth.uid()). Le userId n'est JAMAIS lu depuis le body.

import { createClient } from '@supabase/supabase-js';

// Limites d'appels par utilisateur et par jour (heure de Séoul).
// Surchargeables via des variables d'environnement Vercel : QUOTA_CHAT=300, etc.
const DEFAULT_QUOTAS = {
  chat: 200,
  tts: 200,
  stt: 150,
  'analyze-image': 40,
  'ocr-staging': 20,
  'generate-mission': 20,
  scenarios: 30,
  distill: 20,
};

function quotaFor(endpoint) {
  const envKey = 'QUOTA_' + endpoint.toUpperCase().replace(/-/g, '_');
  const fromEnv = parseInt(process.env[envKey], 10);
  return Number.isFinite(fromEnv) ? fromEnv : DEFAULT_QUOTAS[endpoint];
}

// Minuit à Séoul (UTC+9), exprimé en ISO UTC
function startOfDaySeoul() {
  const now = new Date();
  const seoul = new Date(now.getTime() + 9 * 3600 * 1000);
  seoul.setUTCHours(0, 0, 0, 0);
  return new Date(seoul.getTime() - 9 * 3600 * 1000).toISOString();
}

/**
 * Vérifie le JWT. Renvoie { user, userId, supabase } ou null
 * (dans ce cas la réponse 401 a déjà été envoyée).
 */
export async function requireUser(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'auth_required' });
    return null;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'invalid_session' });
    return null;
  }

  return { user: data.user, userId: data.user.id, supabase };
}

/**
 * Compte un appel payant et refuse au-delà du quota journalier.
 * Renvoie true si l'appel est autorisé, false (429 déjà envoyé) sinon.
 */
export async function consumeQuota(ctx, res, endpoint) {
  const limit = quotaFor(endpoint);
  if (!limit) return true;

  const { count, error } = await ctx.supabase
    .from('api_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('endpoint', endpoint)
    .gte('created_at', startOfDaySeoul());

  if (error) {
    // Table absente ou erreur : on bloque plutôt que de laisser passer sans limite
    console.error('[quota] check failed:', error.message);
    res.status(503).json({ error: 'quota_unavailable' });
    return false;
  }

  if ((count || 0) >= limit) {
    res.status(429).json({ error: 'daily_quota_reached', endpoint, limit });
    return false;
  }

  const { error: insertError } = await ctx.supabase
    .from('api_usage')
    .insert({ user_id: ctx.userId, endpoint });
  if (insertError) console.error('[quota] insert failed:', insertError.message);

  return true;
}
