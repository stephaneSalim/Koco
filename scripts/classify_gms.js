#!/usr/bin/env node
// scripts/classify_gms.js — Classifie les phrases GMS (speech_level + situation_tag)
// Usage : node scripts/classify_gms.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BATCH_SIZE = 100;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── ÉTAPE 1 : Speech Level (regex, no API) ────────────────────────────────────

function classifySpeechLevel(korean) {
  if (/습니다|습니까/.test(korean)) return 'FORMAL';
  if (/요[.!?]?\s*$/.test(korean.trim())) return 'POLITE';
  return 'CASUAL';
}

// ── ÉTAPE 2 : Situation Tag (Claude API, batch 100) ───────────────────────────

async function classifyBatch(rows) {
  const entries = rows.map(r => `${r.gms_id}: "${r.text_kr}"`).join('\n');

  const prompt = `Classifie chaque phrase coréenne avec UN tag parmi :
SHOPPING, SOCIAL, WORK, ADMIN, HEALTH, TRAVEL, ACADEMIC, GENERAL

Phrases :
${entries}

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"1001": "SHOPPING", "1002": "SOCIAL", ...}
Inclus les ${rows.length} IDs.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text?.trim() || '{}';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    console.warn('  Parse failed — defaulting batch to GENERAL. Raw:', raw.slice(0, 200));
    return Object.fromEntries(rows.map(r => [String(r.gms_id), 'GENERAL']));
  }
}

// ── ÉTAPE 3 : Update Supabase ─────────────────────────────────────────────────

async function updateRow(gmsId, speechLevel, situationTag) {
  const { error } = await supabase
    .from('gms_sentences')
    .update({ speech_level: speechLevel, situation_tag: situationTag })
    .eq('gms_id', gmsId);

  if (error) console.error(`  Update failed gms_id=${gmsId}:`, error.message);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching all GMS sentences...');

  const { data: rows, error } = await supabase
    .from('gms_sentences')
    .select('gms_id, text_kr')
    .order('gms_id');

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  if (!rows?.length) { console.error('No rows returned.'); process.exit(1); }

  console.log(`Fetched ${rows.length} sentences. Batches of ${BATCH_SIZE}...\n`);

  let processed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches}: gms_id ${batch[0].gms_id}–${batch.at(-1).gms_id}`);

    // Step 1: speech level (regex, instant)
    const speechLevels = {};
    for (const row of batch) {
      speechLevels[row.gms_id] = classifySpeechLevel(row.text_kr);
    }

    // Step 2: situation tag (Claude Haiku)
    let situationTags;
    try {
      situationTags = await classifyBatch(batch);
    } catch (err) {
      console.error('  Claude error:', err.message, '— defaulting to GENERAL');
      situationTags = Object.fromEntries(batch.map(r => [String(r.gms_id), 'GENERAL']));
    }

    // Step 3: update Supabase (parallel within batch)
    await Promise.all(batch.map(row =>
      updateRow(
        row.gms_id,
        speechLevels[row.gms_id],
        situationTags[String(row.gms_id)] ?? 'GENERAL'
      )
    ));

    processed += batch.length;

    // Sample log
    batch.slice(0, 2).forEach(r => {
      console.log(`  ${r.gms_id} → ${speechLevels[r.gms_id]} / ${situationTags[String(r.gms_id)] ?? 'GENERAL'} — "${r.text_kr.slice(0, 30)}"`);
    });
    console.log(`  Progress: ${processed}/${rows.length}\n`);

    // 1 s pause between batches to avoid rate limiting
    if (i + BATCH_SIZE < rows.length) {
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  console.log(`Done. ${processed} sentences classified.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
