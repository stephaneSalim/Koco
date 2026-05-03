KoCo
Master Architecture Document
Knowledge-Driven Contextual Oracle — Bible Technique
Version: Mai 2026  |  Auteur: Stéphane Salim  |  JBNU
Production: https://kocoo.vercel.app
 
Pilier 1 — Data Schema & Supabase

1.1 Tables principales
lesson_content
Colonne	Description
unit_id (TEXT PK)	Format: snu_5b_14_2 — imposé par app.js via STATE.unitId, JAMAIS deviné par Vision
user_id (TEXT)	Format: user_1776685908380_dq4wy81t5 — window.kocoUserId généré au 1er lancement
vocabulary (TEXT[])	Tableau cumulatif de mots extraits par OCR — max 300 items avant saturation
structures (TEXT[])	Structures grammaticales pures: -기 마련이다, -(으)ㄹ수록 etc.
context_snippets (TEXT[])	Phrases exactes VISIBLES sur la page — zéro invention
theme (TEXT)	Format: [KO] 제목 | [FR] Traduction — max 100 chars
category (TEXT)	Liste fermée: Académique|Technique|Vie_Quotidienne|Économie|Culture|Histoire|Science|Médias|Travail|Environnement
domain_tags (TEXT[])	Tags sémantiques libres: ["leadership", "tradition"]
ocr_confidence (FLOAT)	0.0 à 1.0 — si < 0.3 → warning UI
updated_at (TIMESTAMPTZ)	Mis à jour à chaque upsert cumulatif

Logique UPSERT Cumulatif (commit a32277d)
Le système est CUMULATIF, non destructif. Chaque nouvelle photo ENRICHIT la ligne existante:
// Avant upsert → fetch existant
const { data: existing } = await supabase
  .from("lesson_content")
  .select("vocabulary, structures, context_snippets, domain_tags")
  .eq("unit_id", unitId).eq("user_id", userId).maybeSingle();

// Fusion avec déduplication via Set
const mergedVocab = [...new Set([
  ...(existing?.vocabulary || []),
  ...(extracted.vocabulary || [])
])];

// Seuil de saturation: 300 mots
if (existing?.vocabulary?.length >= 300) {
  return res.json({ alreadyExists: true, saturated: true });
}

gms_sentences
Colonne	Description
gms_id (INTEGER PK)	Numéro Glossika: 1-1000 (F1), 1001-1999 (F2), 2001-2999 (F3)
text_kr (TEXT)	Phrase coréenne exacte
text_en (TEXT)	Traduction anglaise
fluency_level (INTEGER)	1, 2 ou 3 (Glossika Fluency)
snu_unit (TEXT)	GMS_F1, GMS_F2, GMS_F3
situation_tag (TEXT)	SHOPPING|SOCIAL|WORK|ADMIN|HEALTH|TRAVEL|ACADEMIC|GENERAL
speech_level (TEXT)	POLITE|FORMAL|CASUAL — détecté par regex: /습니다/ → FORMAL, ends with 요 → POLITE
Total: 3000 phrases (1000 par Fluency). Classification: Haiku batch 100 phrases.

review_items (SRS)
Colonne	Description
user_id (TEXT)	window.kocoUserId
unit_id (TEXT)	snu_5b_14_2 ou GMS_1042 pour les drills GMS
original (TEXT)	Phrase erronée ou phrase cible GMS
fixed (TEXT)	Version corrigée
success_rate (FLOAT)	0.0 à 1.0
interval_days (INTEGER)	SRS: [1, 3, 7, 14] jours
next_review_at (TIMESTAMPTZ)	Prochaine révision calculée
recurrence_count (INTEGER)	Nb fois vue — >= 3 → is_recurring = true
is_recurring (BOOLEAN)	Si true → injecté en PRIORITÉ 1 dans le prompt système
error_type (TEXT)	major|minor|gms_drill|gms_shadowing|lesson_drill

Autres tables
Table	Rôle
sessions	Historique séances: user_id TEXT, lesson_id TEXT, mode, duration_seconds
corrections	Corrections reçues par session
session_metrics	MLU, mission_score, complexity_index, target_grammar_used
snu_units	Toutes leçons 3A→5B: id, level, unit_number, lesson_number, title_ko, title_en, grand_theme_code
grand_themes	8 thèmes: health|society|environment|culture|work|language|daily_life|technology
drill_sessions	Historique des drills: drill_type, user_answer, is_correct, response_time_ms
shadowing_sessions	target_text, user_transcript, match_score, diff_result, feedback_html
lesson_content_staging	Pipeline Gemini: status pending|committed|rejected, quality_flag AUTO_APPROVE|REVIEW_REQUIRED

Gestion du User ID
window.kocoUserId est généré au premier lancement: "user_" + Date.now() + "_" + Math.random().toString(36).slice(2,10)
Stocké dans localStorage sous la clé "koco_user_id". Jamais UUID — type TEXT partout dans Supabase.
CRITIQUE: Les colonnes user_id et lesson_id dans sessions/corrections sont TEXT, pas UUID. Toute conversion de type casse les politiques RLS.
 
Pilier 2 — Architecture API & Routage (Le Cerveau)

2.1 Dual-Brain Auto-routing (commit babe681)
Le système sélectionne automatiquement le modèle selon la complexité de la requête:
function selectModel(mode, userMessageLength, hasRecurringErrors) {
  // Sonnet pour les cas complexes
  if (mode === "mission" || mode === "debate" ||
      userMessageLength > 200 ||
      hasRecurringErrors === true) {
    return "claude-sonnet-4-6";
  }
  // Haiku pour tout le reste (80% des cas)
  return "claude-haiku-4-5-20251001";
}

Condition	Modèle sélectionné
mode === "mission" ou "debate"	claude-sonnet-4-6
userMessage.length > 200 chars	claude-sonnet-4-6
hasRecurringErrors === true	claude-sonnet-4-6
Tous les autres cas (freeChat, speak, daily_life)	claude-haiku-4-5-20251001

2.2 Prompt Caching Anthropic
Header requis: "anthropic-beta": "prompt-caching-2024-07-31"
Le system prompt est divisé en 2 blocs:
•	Partie statique (KOCO_PRINCIPLES + contexte unité) → cache_control: { type: "ephemeral" }
•	Partie dynamique (erreurs récurrentes) → pas de cache (change à chaque session)
Minimum 1024 tokens dans le bloc pour que le cache s'active. Économie théorique: -90% input tokens sur les sessions longues.

2.3 Sliding Window (8 messages)
function getWindowedHistory() {
  const history = STATE.messages || [];
  return history.slice(-8); // 4 tours user/assistant
}
Évite l'explosion exponentielle du coût sur les longues sessions.

2.4 Max Tokens adaptatif par mode
Mode	max_tokens
mission / debate	800
speak / freeChat	600
daily_life	500
default	600

2.5 Endpoints Vercel (api/)
Endpoint	Rôle & Modèle
api/chat.js	Conversation principale — Auto-routing Haiku/Sonnet
api/analyze-image.js	OCR ETL — claude-haiku-4-5-20251001 (5x moins cher)
api/distill.js	Post-processing erreurs → drills — claude-haiku-4-5-20251001
api/generate-mission.js	Mission SNU Graduate — Sonnet finale + Haiku filtrage Pass 2
api/scenarios.js	Génération 3 scénarios — claude-haiku-4-5-20251001
api/knowledge-snapshot.js	Snapshot maîtrise — RPC Supabase get_knowledge_snapshot()
api/stt.js	Speech-to-Text — ElevenLabs scribe_v1, language: ko
api/tts.js	Text-to-Speech — ElevenLabs voice sf8Bpb1IU97NI9BHSMRf, eleven_multilingual_v2
api/distill.js	Distillateur — déclenché si >= 3 erreurs major/minor ET session > 5min
api/ocr-staging.js	Pipeline Gemini via OpenRouter — staging avant commit production
api/staging-commit.js	Commit staging → lesson_content avec merge cumulatif
 
Pilier 3 — Moteur de Shadowing (GMS & Lesson Drill)

3.1 Algorithme SRS exact
Condition	Intervalle SRS
Maîtrisé + score > 90%	7 jours (mastered_high)
Maîtrisé + score 80-90%	3 jours (mastered_mid)
Difficile (bouton)	1 jour
Échec après 3 tentatives	1 jour + recurrence_count++

3.2 Shadowing Mécanique — Flux complet
•	ÉTAPE 1 — Auto-play ElevenLabs TTS: speakKorean(phrase.text_kr) au chargement du modal
•	ÉTAPE 2 — Enregistrement: MediaRecorder (pointerdown → start, pointerup → stop)
•	ÉTAPE 3 — Transcription: ElevenLabs Scribe v1, language_code: "ko", retourne transcript
•	ÉTAPE 4 — Analyse: analyzeShadowing(target, transcript) — comparaison token par token
•	ÉTAPE 5 — Feedback coloré: vert = matched, orange = partial (2 premiers chars), rouge = substituted, gris barré = omitted
•	ÉTAPE 6 — Seuil: score >= 80% → boutons Difficile/Maîtrisé débloqués. Max 3 tentatives avant déblocage forcé

3.3 Analyse comparative (analyzeShadowing)
function analyzeShadowing(target, transcript) {
  const clean = text => text
    .replace(/[^\uAC00-\uD7A3\s]/g, "")
    .split(/\s+/).filter(Boolean);
  
  const targetWords = clean(target);
  const transcriptWords = clean(transcript);
  
  const wordResults = targetWords.map((word, i) => {
    if (!transcriptWords[i]) return { status: "omitted" };
    if (transcriptWords[i] === word) return { status: "matched" };
    if (transcriptWords[i].slice(0,2) === word.slice(0,2))
      return { status: "partial" };
    return { status: "substituted" };
  });
  
  const score = Math.round(
    ((matched + partial * 0.5) / targetWords.length) * 100
  );
}

3.4 Injection GMS situationnelle (Mode Terrain)
Détection de situation dans le message utilisateur (côté client ET serveur):
Keywords détectés	situation_tag
슈퍼, 마트, 가격, 얼마, prix, acheter	SHOPPING
병원, 의사, 아프, 약, médecin, malade	HEALTH
회사, 직장, 업무, travail, bureau	WORK
서류, 비자, 은행, visa, banque	ADMIN
지하철, 버스, 택시, métro, bus	TRAVEL
수업, 교수, 논문, cours, thèse	ACADEMIC
친구, 약속, 식당, ami, restaurant	SOCIAL
(aucun match)	GENERAL
Les phrases GMS filtrées par situation_tag sont injectées dans les balises <gms_ref> du prompt Daily Life.
 
Pilier 4 — Frontend & Parsing (UI/UX)

4.1 Balises de réponse attendues par le frontend
[CORRECTION] block — tous les modes
[CORRECTION]
STATUS: correct|minor|major
ORIGINAL: (phrase exacte de l'utilisateur)
FIXED: (version corrigée naturelle)
NOTE: (explication courte en français)
TARGET_USED: (structure cible si applicable)
ANKI_READY: true|false
[/CORRECTION]

[SPEAK_RESPONSE] block — mode Speak uniquement
[SPEAK_RESPONSE]
VALIDATION: (1 phrase validant l'idée — coréen)
NATIVE_POLISH: (version native améliorée — vide si correct)
NATIVE_REASON: (explication courte en français)
TARGET_USED: (structure cible utilisée)
PIVOT_QUESTION: (question de relance — coréen)
[/SPEAK_RESPONSE]

[MISSION_SCORE] block — fin de mission
[MISSION_SCORE]
LEVEL: 5B
STRUCTURES_USED: -기 마련이다[Mastered], -ㄹ수록[Used]
STRUCTURES_MISSED: -는 한
FORBIDDEN_COUNT: 2
COMPLEXITY_INDEX: 7/10
SCORE: 8/10
VERDICT: (évaluation concise en coréen académique)
[/MISSION_SCORE]

[DRILL_SESSION] block — après MISSION_SCORE
[DRILL_SESSION]
LEVEL: 5B
DRILL_1_TYPE: reformulation
DRILL_1_PROMPT: (phrase à reformuler)
DRILL_1_TARGET: (structure cible)
DRILL_1_ANSWER: (version correcte)
... (DRILL_2, DRILL_3 identiques)
[/DRILL_SESSION]

[GOLDEN_SENTENCE] block — fin de session Speak
[GOLDEN_SENTENCE]
SENTENCE: (meilleure phrase produite par l'utilisateur)
WHY: (explication courte en français)
STRUCTURES_DETECTED: (structures cibles utilisées)
[/GOLDEN_SENTENCE]

4.2 État global STATE (app.js)
Variable STATE	Rôle
STATE.unitId	ID unité active: "snu_5b_14_2"
STATE.activeUnit	Objet unité complet depuis snu_units Supabase
STATE.mode	"freeChat"|"speak"|"mission"|"daily_life"|"debate"
STATE.messages	Historique conversation (windowed à 8 pour API)
STATE.corrections	Corrections de la session courante
STATE.recurringErrors	Erreurs is_recurring=true — chargées au démarrage
STATE.sessionStart	Date.now() au premier message — pour Ghost Save
STATE.gmsDrillPhrases	Phrases du drill GMS en cours
STATE.gmsDrillIndex	Index phrase courante dans le drill
STATE.currentSNUMission	Mission SNU Graduate active
STATE.knowledgeSnapshot	Données snapshot pour Recall Mode
STATE.missionOverride	Config mission overridée par Vision OCR
MissionMgr	Classe MissionManager: active, override, exchangeCount, scoreDetected
AudioGate	Objet: muted, activeController (AbortController ElevenLabs)
_gmsCache	Cache mémoire GMS par unitId — reset au changement d'unité
 
Pilier 5 — System Prompt & KOCO_PRINCIPLES

5.1 Hiérarchie du contexte injecté (max 800 tokens)
Priorité	Contenu
1 — ABSOLUE	Erreurs récurrentes (is_recurring=true) — max 200 tokens
2 — HAUTE	lesson_content unité active (vocab + structures) — max 300 tokens
3 — MOYENNE	Phrases GMS pertinentes — max 200 tokens
4 — BASSE	Mission Sheet si mode mission — max 100 tokens
5 — OPTIONNELLE	Knowledge Snapshot si recall mode

5.2 KOCO_PRINCIPLES (injecté dans tous les modes)
LOI 1 RÉCURRENCE: Erreur récurrente détectée →
recadrage constructif immédiat + drill ciblé.
"이 표현은 반복적인 오류입니다." + amorce correction.
FEEDBACK TOUJOURS VISIBLE — jamais silencieux.

LOI 2 EXTRACTION: Après session → structures
correctes 2+ fois avec certitude > 0.8 uniquement.
Doute = omission. Qualité > quantité.

LOI 3 GHOST SAVE: La SAUVEGARDE est silencieuse.
La CORRECTION des erreurs récurrentes est visible.

LOI 4 MODÈLES: Haiku = fond. Sonnet = évaluation.

5.3 Modes et personnalités
Mode	Personnalité & Niveau
freeChat	3-4급, chaleureux, 1 question max, correction douce
speak	Coach flexible, Soft Recasting, jamais de ❌ direct, Token Recycling
mission	Proctor strict 5-6급, blocking si structure non utilisée, tolérance zéro
daily_life	Terrain, Hybrid RAG, 2 variantes (Cours + Fluency), GMS situationnel
debate	5-6급, position opposée, structures avancées obligatoires

5.4 Calibration Matrix Mission (Severity Levels)
Niveau	Severity
3A/3B	morphological
4A/4B	argumentative
5A/5B	academic
6A/6B	thesis
 
Pilier 6 — Historique des Échecs / Lessons Learned

6.1 Ce qu'on a essayé et REJETÉ — Gemini ne doit PAS proposer
❌ Bouton manuel "Mode Expert" Haiku/Sonnet
Rejeté car: L'utilisateur ne sait pas quand il a besoin de Sonnet. Haiku mal-formate les blocs [CORRECTION] sur ~20% des messages → parsing cassé silencieusement. Remplacé par: auto-routing basé sur mode + longueur + erreurs récurrentes.
❌ tsvector / pg_korean pour recherche coréenne
Rejeté car: PostgreSQL tsvector ne tokenise pas correctement le coréen sans extension pg_korean non disponible sur Supabase. Solution retenue: ilike avec keywords extraits du message.
❌ BKT (Bayesian Knowledge Tracing)
Rejeté car: Nécessite des centaines d'observations par point de grammaire. Volume actuel insuffisant. Remplacé par: SRS simple avec success_rate + interval_days.
❌ Podcast audio généré automatiquement
Rejeté car: Coût ElevenLabs récurrent ($0.08/podcast) pour valeur marginale. Tout ce que le podcast ferait est déjà dans le Drill du jour + Mode Terrain + TTS conversation.
❌ Gemini comme moteur de chat principal
Rejeté car: Gemini ne respecte pas les formats [CORRECTION][/CORRECTION] et [SPEAK_RESPONSE] calibrés pour Claude. Le parsing côté client casserait silencieusement. Architecture retenue: Gemini = OCR uniquement, Claude = chat + mission + correction.
❌ Prompt massif 10 pages pour OCR
Rejeté car: Le modèle moyenne son attention — les structures de la page 3 contaminent l'extraction de la page 7. Règle: max 3 pages par appel Gemini/Claude Vision.
❌ Single().instead of maybeSingle()
Critique: .single() lève une erreur 406 si 0 résultats. Toujours utiliser .maybeSingle() qui retourne null proprement. Bug récurrent dans les premières versions.
❌ user_id et lesson_id en UUID dans sessions/corrections
Critique: KoCo utilise des user_id TEXT (user_1776...). Tout constraint UUID casse les insertions. TOUTES les colonnes user_id et lesson_id doivent être TEXT.
❌ RLS policies séparées par opération
Remplacé par: Une seule policy FOR ALL USING (true) WITH CHECK (true) par table. Les 4 policies séparées (SELECT/INSERT/UPDATE/DELETE) créent des conflits.
 
Pilier 7 — Profil Utilisateur (Contexte JBNU)

7.1 Identité académique
Attribut	Valeur
Nom	Stéphane Salim
Institution	Jeonbuk National University (JBNU), Jeonju, Corée du Sud
Programme	Master/Doctorat — Industrial & Information Systems Engineering
Laboratoire	Pr. Yang's lab (focus Data Science, clustering, systèmes industriels)
Objectif coréen	TOPIK 5-6급 — usage académique et professionnel
Manuel principal	SNU Korean 5A/5B (Seoul National University curriculum)
Ressource complémentaire	Glossika GMS Fluency 1-2-3 (3000 phrases indexées)

7.2 Besoins pédagogiques spécifiques
•	Registre: Formel et académique — pas "touriste". Le coréen de labo, de conférence, d'administration universitaire.
•	Structures cibles: Niveau 5B+ — -기 마련이다, -(으)ㄹ따름이다, -는 한, -느니만큼, -거들랑
•	Situations réelles: JBNU administratif, supermarché Jeonju, transport Jeollabuk, interactions avec Pr. Yang
•	Contrainte budget: Optimisation extrême des coûts API. Objectif: < $3/mois pour usage quotidien intensif.
•	Profil Data Science: Habitué aux pipelines ETL, schémas de données, évaluation de modèles. Comprend les trade-offs architecturaux.

7.3 Environnement technique
Composant	Valeur
Device principal	Samsung Galaxy (Android) — Samsung keyboard, Samsung browser
PC	Windows — Chrome DevTools pour debug
Connexion	SKT Korea 5G
App URL	https://kocoo.vercel.app
GitHub	https://github.com/stephaneSalim/Koco (branche main, push via master:main)
Supabase Project	jxbqlphxsgglrlznpall.supabase.co
ElevenLabs	Pay as you go — voice ID: sf8Bpb1IU97NI9BHSMRf — TTS + STT activés
OpenRouter	Configuré pour Gemini via api/ocr-staging.js (staging pipeline)

7.4 Variables d'environnement Vercel (toutes requises)
ANTHROPIC_API_KEY     → Claude Haiku + Sonnet
SUPABASE_URL          → https://jxbqlphxsgglrlznpall.supabase.co
SUPABASE_ANON_KEY     → sb_publishable_... (format nouveau Supabase)
ELEVENLABS_API_KEY    → Clé KoCo avec TTS+STT activés (Speech to Text: Access ON)
OPENROUTER_API_KEY    → Pour api/ocr-staging.js (Gemini pipeline)

7.5 Coûts réels estimés post-optimisation
Source de coût	Estimation mensuelle
Chat Claude Haiku (80% des messages)	~$0.80/mois (50 sessions × 20 msg)
Chat Claude Sonnet (20% messages complexes)	~$0.60/mois
OCR Claude Haiku (photos manuels)	~$0.30/mois (100 photos)
ElevenLabs TTS (conversations)	~$0.80/mois
ElevenLabs STT (push-to-talk)	~$0.20/mois
Supabase	Gratuit (dans les limites du plan)
TOTAL ESTIMÉ	~$2.70/mois


KoCo Master Architecture Document — Fin du document
Généré automatiquement — Mai 2026
