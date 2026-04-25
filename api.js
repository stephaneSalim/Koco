/**
 * KoCo — Korean Conversation Companion
 * api.js — Anthropic API Handler & System Prompt Logic
 * 
 * Manages:
 * - API key lifecycle (localStorage-first, user input on first launch)
 * - System prompt generation (fluency-focused, structure-aware)
 * - Message history and context management
 * - Response parsing and structure detection
 */

// ═══════════════════════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const API_ENDPOINT = isLocal ? 'http://localhost:3000/api/chat' : '/api/chat';
const TTS_ENDPOINT = isLocal ? 'http://localhost:3000/api/tts' : '/api/tts';

const API_CONFIG = {
  STORAGE_KEY: 'koco_anthropic_api_key',
  API_ENDPOINT: API_ENDPOINT,
  TTS_ENDPOINT: TTS_ENDPOINT,
  MODEL: 'claude-sonnet-4-20250514'
};

/**
 * Check if API key is stored in localStorage
 * @returns {boolean} True if API key exists
 */
function hasApiKey() {
  return !!localStorage.getItem(API_CONFIG.STORAGE_KEY);
}

/**
 * Get API key from localStorage
 * @returns {string|null} API key or null if not found
 */
function getApiKey() {
  return localStorage.getItem(API_CONFIG.STORAGE_KEY);
}

/**
 * Store API key in localStorage after validation
 * @param {string} apiKey - Anthropic API key
 * @returns {boolean} True if stored successfully
 */
function setApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    console.error('Invalid API key format');
    return false;
  }
  
  // Basic validation: starts with sk-ant-
  if (!apiKey.startsWith('sk-ant-')) {
    console.warn('API key does not start with sk-ant-, but storing anyway');
  }
  
  localStorage.setItem(API_CONFIG.STORAGE_KEY, apiKey.trim());
  return true;
}

/**
 * Clear API key from localStorage
 */
function clearApiKey() {
  localStorage.removeItem(API_CONFIG.STORAGE_KEY);
}

/**
 * Request API key from user (UI integration point)
 * Returns true if user provided a key, false if cancelled
 * @returns {Promise<boolean>}
 */
async function requestApiKeyFromUser() {
  return new Promise((resolve) => {
    // This will be called from app.js when needed
    // For now, just return false - app.js will handle the UI flow
    resolve(false);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CALIBRATION MATRIX 3A → 5B + SYSTEM PROMPT GENERATION
// ═══════════════════════════════════════════════════════════════════════════

const MISSIONS_CONFIG = {

  // ── 3A/3B : Morphological Accuracy ──────────────
  '3A': {
    difficulty_level: '3A',
    severity: 'morphological',
    objective: 'Morphological Accuracy — connecteurs de base maîtrisés',
    target_grammar: ['-아/어서', '-(으)ㄹ 것 같다', '-고 싶다', '-는데'],
    forbidden_patterns: ['음...', '그냥', '좀', '뭐'],
    min_clauses: 2,
    tolerance: 'medium',
    mission_brief: '기본 연결어와 형태소를 정확하게 사용하세요.',
    topic: '일상 표현'
  },
  '3B': {
    difficulty_level: '3B',
    severity: 'morphological',
    objective: 'Morphological Accuracy — expressions de regret et possibilité',
    target_grammar: ['-았/었으면 좋겠다', '-는 것 같다', '-(으)ㄹ 수 있다', '-아/어 보다'],
    forbidden_patterns: ['그냥', '좀', '음...', '뭐'],
    min_clauses: 2,
    tolerance: 'medium',
    mission_brief: '가능성과 바람을 정확한 형태소로 표현하세요.',
    topic: '경험과 바람'
  },

  // ── 4A/4B : Argumentative Flow ───────────────────
  '4A': {
    difficulty_level: '4A',
    severity: 'argumentative',
    objective: 'Argumentative Flow — contexte social nuancé',
    target_grammar: ['-는 바람에', '-(으)ㄹ 뻔했다', '-고 나서', '-(으)ㄴ 덕분에'],
    forbidden_patterns: ['그리고', '그냥', '좀', '근데'],
    min_clauses: 2,
    tolerance: 'low',
    mission_brief: '사회적 맥락을 논리적 흐름으로 설명하세요.',
    topic: '사회와 변화'
  },
  '4B': {
    difficulty_level: '4B',
    severity: 'argumentative',
    objective: 'Argumentative Flow — structures conditionnelles avancées',
    target_grammar: ['-는다고 해서', '-(으)ㄹ수록', '-던', '-(으)ㄴ/는 반면에'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '근데'],
    min_clauses: 2,
    tolerance: 'low',
    mission_brief: '조건과 대조를 활용한 논증을 구성하세요.',
    topic: '태도와 비교'
  },

  // ── 5A : Academic Precision ───────────────────────
  'snu_5a_1_1': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision — nutrition et santé',
    target_grammar: ['-아/어야 하다', '-는 편이다', '-기 위해서'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '그래가지고'],
    min_clauses: 2,
    tolerance: 'zero',
    mission_brief: '영양에 대해 학문적 표현을 사용하여 논증하세요.',
    topic: '음식과 영양'
  },
  'snu_5a_2_1': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision — bonheur et repos',
    target_grammar: ['-기 마련이다', '-(으)ㄹ수록', '-다 보면'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '그래가지고'],
    min_clauses: 2,
    tolerance: 'zero',
    mission_brief: '행복의 조건을 논리적으로 주장하세요.',
    topic: '행복과 휴식'
  },
  'snu_5a_3_1': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision — langue et culture',
    target_grammar: ['-(으)ㄴ/는 데에 비해서', '-는 반면에', '-(으)ㄹ 따름이다'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '그래가지고'],
    min_clauses: 2,
    tolerance: 'zero',
    mission_brief: '언어와 문화의 관계를 비교하며 분석하세요.',
    topic: '언어와 문화'
  },
  'snu_5a_4_1': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision — stéréotypes',
    target_grammar: ['-는 탓에', '-(으)ㄴ/는 셈이다', '-기는커녕'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '그래가지고'],
    min_clauses: 2,
    tolerance: 'zero',
    mission_brief: '고정관념의 문제점을 학문적으로 비판하세요.',
    topic: '사고와 고정 관념'
  },
  'snu_5a_5_1': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision — climat',
    target_grammar: ['-에 따라', '-(으)ㄹ 것으로 보인다', '-는 추세이다'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '그래가지고'],
    min_clauses: 2,
    tolerance: 'zero',
    mission_brief: '기후 변화의 원인과 결과를 분석하세요.',
    topic: '기후와 지형'
  },
  'snu_5a_6_1': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision — environnement',
    target_grammar: ['-와/과 더불어', '-을/를 통해', '-(으)ㄴ 결과'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '그래가지고'],
    min_clauses: 2,
    tolerance: 'zero',
    mission_brief: '환경과 주거 공간의 관계를 분석하세요.',
    topic: '환경과 주거 공간'
  },
  'snu_5a_7_1': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision — psychologie',
    target_grammar: ['-는 경향이 있다', '-(으)ㄹ 수밖에 없다', '-에 의해'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '그래가지고'],
    min_clauses: 2,
    tolerance: 'zero',
    mission_brief: '인간 심리와 관계를 학문적으로 분석하세요.',
    topic: '인간과 심리'
  },
  'snu_5a_8_1': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision — avenir du travail',
    target_grammar: ['-아/어질 것이다', '-에 따른', '-(으)ㄹ 전망이다'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '그래가지고'],
    min_clauses: 2,
    tolerance: 'zero',
    mission_brief: '직업의 미래를 데이터 기반으로 논증하세요.',
    topic: '직업의 미래'
  },

  // ── 5A générique ──────────────────────────────────
  '5A': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision',
    target_grammar: ['-기 마련이다', '-(으)ㄹ수록', '-는 한', '-다 보면', '-(으)ㄹ 따름이다'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '그래가지고'],
    min_clauses: 2,
    tolerance: 'zero',
    mission_brief: '고급 연결 표현을 활용하여 학문적으로 논증하세요.',
    topic: '학술 표현'
  },

  // ── 5B : Academic Precision + Hanja ──────────────
  '5B': {
    difficulty_level: '5B',
    severity: 'academic',
    objective: 'Academic Precision — tolérance zéro, Hanja requis',
    target_grammar: ['-느니만큼', '-거들랑', '-다가는', '-(으)ㄹ진대'],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '근데', '그래가지고'],
    min_clauses: 3,
    tolerance: 'zero',
    mission_brief: '한자어를 활용하여 학문적 수준의 논증을 구성하세요.',
    topic: '고급 학술 표현'
  },

  // ── 6A : Thesis / Academic Mastery ───────────────
  '6A': {
    difficulty_level: '6A',
    severity: 'thesis',
    objective: 'Thesis Mastery — argumentation académique complète avec hanja',
    target_grammar: [
      '-(으)ㄹ진대',
      '-거니와',
      '-ㄴ/는다는 점에서',
      '-에 기인하다',
      '-을/를 고려할 때',
      '-(이)라 할지라도'
    ],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '근데', '그래가지고', '뭐', '막', '되게'],
    min_clauses: 3,
    tolerance: 'zero',
    hanja_required: true,
    repetition_penalty: true,
    mission_brief: '논문 수준의 주장을 한자어와 고급 연결어로 전개하세요.',
    topic: '학술 논증'
  },

  // ── 6B : Expert Academic / Discourse Analysis ────
  '6B': {
    difficulty_level: '6B',
    severity: 'thesis',
    objective: 'Expert Academic — discourse analysis, no deictics, no repetition',
    target_grammar: [
      '-는 바이다',
      '-(으)ㄹ 나위 없다',
      '-에 불과하다',
      '-를 감안하면',
      '-는 데 그치지 않고',
      '-(으)로 귀결되다'
    ],
    forbidden_patterns: [
      '그리고', '그래서', '그냥', '좀', '근데', '그래가지고',
      '뭐', '막', '되게', '이것', '저것', '그것', '여기', '저기'
    ],
    min_clauses: 3,
    tolerance: 'zero',
    hanja_required: true,
    repetition_penalty: true,
    mission_brief: '지시어 없이 논문 수준의 담화를 구성하세요.',
    topic: '전문 담화 분석'
  },

  // ── 6_dynamic : Dynamic fallback for unknown 6x ──
  '6_dynamic': {
    difficulty_level: '6',
    severity: 'thesis',
    objective: 'Thesis Level — dynamic configuration',
    target_grammar: [
      '-(으)ㄹ진대',
      '-거니와',
      '-ㄴ/는다는 점에서',
      '-에 기인하다',
      '-를 감안하면',
      '-는 바이다'
    ],
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀', '근데', '그래가지고', '뭐', '막', '되게'],
    min_clauses: 3,
    tolerance: 'zero',
    hanja_required: true,
    repetition_penalty: true,
    dynamic: true,
    mission_brief: '논문 수준의 학술 논증을 구성하세요.',
    topic: '학술 담화'
  },

  // ── Default fallback ──────────────────────────────
  'default': {
    difficulty_level: '5A',
    severity: 'academic',
    objective: 'Academic Precision',
    target_grammar: ['-기 마련이다', '-(으)ㄹ 따름이다', '-는 한'],
    forbidden_patterns: ['그리고', '그래서', '그냥'],
    min_clauses: 2,
    tolerance: 'low',
    mission_brief: '고급 표현을 사용하여 논리적으로 말하세요.',
    topic: '자유 주제'
  }
};

window.MISSIONS_CONFIG = MISSIONS_CONFIG;

function resolveMissionConfig(unitId) {
  if (!unitId) return MISSIONS_CONFIG['default'];
  if (MISSIONS_CONFIG[unitId]) return MISSIONS_CONFIG[unitId];

  const levelMatch = unitId.match(/snu_(\w+)_/);
  if (levelMatch) {
    const level = levelMatch[1].toUpperCase();
    if (level.startsWith('6')) return MISSIONS_CONFIG['6_dynamic'];
    if (MISSIONS_CONFIG[level]) return MISSIONS_CONFIG[level];
  }

  return MISSIONS_CONFIG['default'];
}
window.resolveMissionConfig = resolveMissionConfig;

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate system prompt for conversation companion
 * CRITICAL: Optimized for FLUENCY, not perfection
 *
 * @param {Object} context - Session context from data.js
 *   - unit: current unit data
 *   - targetLevel: competency level (1, 2, or 3)
 *   - targetStructures: grammar structures for this unit
 *   - allTargetStructures: all structures for this level
 *   - vocabulary: unit vocabulary
 * @param {string} mode - Practice mode (freeChat, debate, speaking, speedDrill)
 * @returns {string} System prompt for Claude
 */
function generateSystemPrompt(context, mode, gmsSentences, pageContext) {
  const { unit, vocabulary } = context;

  const unitTitle = unit ? `${unit.title} — ${unit.subtitle}` : '자유 주제';
  const unitTheme = unit?.theme || '';
  const grandTheme = unit?.grand_theme_label_fr || '';
  const sousTheme = unit?.sous_theme || '';
  const snuLevel = unit?.level || '';

  const gmsLines = gmsSentences && gmsSentences.length > 0
    ? gmsSentences.map(s => `  • ${s.text_kr} — ${s.text_en}`).join('\n')
    : '  (없음)';

  const vocabLines = vocabulary && vocabulary.length > 0
    ? vocabulary.slice(0, 8).map(v => `  • ${v.korean} (${v.meaning})`).join('\n')
    : '';

  const pageContextBlock = pageContext
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTENU DE LA PAGE DU JOUR (priorité maximale)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Thème : ${pageContext.theme}
Niveau : ${pageContext.level}
Vocabulaire : ${(pageContext.vocabulary || []).join(', ')}
Structures : ${(pageContext.structures || []).join(', ')}
Questions suggérées :
${(pageContext.conversation_starters || []).map(q => `  • ${q}`).join('\n')}

Utilise ce contenu comme base principale de la conversation.`
    : '';

  const correctionBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORRECTION BLOCK (REQUIRED — every response)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After every conversational response, append this block exactly:

[CORRECTION]
STATUS: correct|minor|major
ORIGINAL: (exact phrase from user)
FIXED: (corrected natural version)
NOTE: (one short explanation in French)
[/CORRECTION]

- STATUS correct → perfectly natural (FIXED = ORIGINAL)
- STATUS minor → small error (particle, conjugation)
- STATUS major → error blocking comprehension
- This block must ALWAYS be present`;

  if (mode === 'mission') {
    const missionCfg = context.missionOverride || resolveMissionConfig(context.unitId);

    const severity = missionCfg.severity || 'academic';
    const tolerance = missionCfg.tolerance || 'low';
    const isThesisLevel = severity === 'thesis' || (missionCfg.difficulty_level || '').startsWith('6');

    const severityDesc = {
      morphological: '형태소 정확성 — 기본 연결어와 문법 구조 완성도',
      argumentative: '논증 흐름 — 사회적 맥락과 논리적 전개',
      academic: '학문적 정밀도 — 한자어 활용, 논문 수준 표현',
      thesis: '논문 수준 완성도 — 지시어 금지, 한자어 필수, 반복 표현 제재'
    };

    const toleranceDesc = {
      medium: '중간 — 기본 오류는 허용, 구조 오류는 수정 요구',
      low: '낮음 — 모든 구조 오류 즉시 차단',
      zero: '제로 — 단 하나의 금지 표현도 허용하지 않음'
    };

    const registerNote = isThesisLevel
      ? '\n- 구어체 표현 일체 금지 (격식체 종결어미 의무: -ㅂ니다/습니다)'
      : '';
    const hanjaNote = missionCfg.hanja_required
      ? '\n- 한자어 필수 사용 (고유어 대체 가능한 경우라도 한자어 우선)'
      : '';
    const repetitionNote = missionCfg.repetition_penalty
      ? '\n- 동일 어휘/구조 반복 시 감점 (반복 패턴 자동 감지)'
      : '';

    const thesisModeBlock = isThesisLevel ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THESIS MODE [NIVEAU 6]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

논문급 담화 요구사항:
1. 지시어 (이것/저것/그것/여기/저기) 완전 금지
2. 격식체 종결어미만 허용 (-ㅂ니다/습니다/입니다)
3. 한자어 우선 원칙 적용
4. 동일 구조 연속 2회 이상 사용 시 즉시 차단
5. 논리적 연결 필수: 각 절이 인과·대조·귀결 관계로 연결될 것

권장 고급 연결어:
• 나아가 / 더불어 / 이에 반해 / 이를 바탕으로
• 결론적으로 / 종합하면 / 구체적으로는
• ~에 기인하여 / ~로 귀결되어 / ~를 감안할 때

논문 채점 기준:
- 완전한 논리 구조 (서론-본론-결론) → +2점
- 한자어 3개 이상 자연스럽게 사용 → +1점
- 지시어 0회 → +1점
- 목표 구조 전문적 사용 → +2점
` : '';


    return `당신은 KoCo-Expert입니다.
TOPIK ${missionCfg.difficulty_level} 전문 지도 교수.
모델: 연구실 지도교수 — 엄격하고 정밀하며 결과 중심.
타협 없음. 불충분한 답변은 절대 통과시키지 않음.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEVEL: ${missionCfg.difficulty_level}
SEVERITY: ${severityDesc[severity] || severity}
TOLERANCE: ${toleranceDesc[tolerance] || tolerance}
UNIT: ${unitTitle}
MISSION: ${missionCfg.mission_brief}
${missionCfg.mission_sheet ? '📋 CALIBRATION: Dynamic Mission Sheet Active' : context.missionOverride ? '⚡ CALIBRATION: Vision OCR Override Active' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MISSION SHEET — PROCTOR CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GRAMMAR TARGETS (${(missionCfg.target_grammar || []).length}/5 max) :
${(missionCfg.target_grammar || []).map(g => `• ${g}`).join('\n')}

VOCABULARY TARGETS (${Math.min((missionCfg.vocabulary || []).length, 12)}/12 max) :
${(missionCfg.vocabulary || []).slice(0, 12).join(', ')}

${(missionCfg.weak_points || []).length > 0 ? `WEAK POINTS (priorité maximale — structures ratées) :
${(missionCfg.weak_points || []).map(w =>
  `• "${w.original}" → "${w.fixed}" [${w.interval_days || 1}j]`
).join('\n')}
→ Ces erreurs DOIVENT être ciblées en priorité.
→ Si l'utilisateur reproduit ces erreurs → bloquer immédiatement.
` : ''}

RÔLE DU PROCTOR :
1. Steer la conversation pour forcer l'usage des GRAMMAR TARGETS et VOCABULARY TARGETS
2. Les WEAK POINTS ont priorité absolue
3. Chaque réponse doit activer au moins 1 token de la Mission Sheet
4. Si 2 échanges consécutifs sans activation → forcer explicitement :
   "다음 표현을 사용하여 답하세요: [token]"

평가 기준 (3단계) :
- 형식적 사용 → STATUS: minor | "형식적 사용 — 더 깊이"
- 적절한 사용 → STATUS: correct | 짧은 검증
- 전문적 사용 → STATUS: correct | "탁월한 표현입니다"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCTION CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

금지 표현 (절대 금지):
${(missionCfg.forbidden_patterns || []).map(p => `• "${p}"`).join('\n')}

최소 요구사항:
- 응답당 최소 ${missionCfg.min_clauses || 2}개의 복잡한 절
- 매 응답에 목표 구조 최소 1개 사용
- 한자어 우선 사용 (5A/5B/6A/6B)${registerNote}${hanjaNote}${repetitionNote}
${thesisModeBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOCKING PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

목표 구조 미사용 시:
"❌ [구조] 미사용
다음 표현으로 재구성하세요: [아무개]
수정 후 계속 진행 가능합니다."

금지 표현 감지 시:
"⚠️ '[표현]' 감지 (${tolerance === 'zero' ? '절대 금지' : '금지'})
대체 연결어: [대안 제시]
재작성 후 계속 진행."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COACH FLEXIBILITY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.selectedScenario ? `SCÉNARIO SÉLECTIONNÉ : ${context.selectedScenario.title}
GOLDEN THREAD :
${(context.selectedScenario.golden_thread || []).join('\n')}
` : ''}
RÈGLE DE FLEXIBILITÉ :
1. Si l'utilisateur suit le Golden Thread → "논리적 흐름이 탁월합니다 ✓" + continue
2. Si l'utilisateur choisit son propre chemin MAIS utilise les structures cibles correctement → "독창적 접근 + 정확한 구조 사용 ✓"
3. Si l'utilisateur utilise les collocations avancées → "고급 연어 사용 — 매우 인상적입니다"
4. Objectif = structures correctes, pas conformité rigide au Golden Thread.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISION CALIBRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${context.missionOverride ? `
⚡ OCR OVERRIDE ACTIVE
이미지에서 추출된 구조와 어휘로 세션 재보정됨:
어휘: ${(missionCfg.vocabulary || []).join(', ')}
구조: ${(missionCfg.target_grammar || []).join(' / ')}
` : ''}
${pageContextBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SCORING (after 8 exchanges)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate EXACTLY this parseable block:

[MISSION_SCORE]
LEVEL: ${missionCfg.difficulty_level}
STRUCTURES_USED: (ex: -기 마련이다[Mastered], -ㄹ수록[Used])
STRUCTURES_MISSED: (ex: -는 한)
FORBIDDEN_COUNT: (int — nombre total de patterns interdits détectés)
COMPLEXITY_INDEX: (X/10)
SCORE: (X/10)
VERDICT: (concise academic Korean evaluation)
[/MISSION_SCORE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DRILL SESSION PROTOCOL (immédiatement après MISSION_SCORE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Immédiatement après [/MISSION_SCORE], génère ce bloc basé sur les erreurs réelles de la séance ou les STRUCTURES_MISSED :

[DRILL_SESSION]
LEVEL: ${missionCfg.difficulty_level}

DRILL_1_TYPE: reformulation
DRILL_1_PROMPT: (phrase incorrecte ou structure manquée de la séance)
DRILL_1_TARGET: (structure grammaticale cible)
DRILL_1_ANSWER: (version correcte et naturelle)

DRILL_2_TYPE: completion
DRILL_2_PROMPT: (phrase à compléter avec ___ pour la structure non maîtrisée)
DRILL_2_TARGET: (structure grammaticale cible)
DRILL_2_ANSWER: (complétion correcte)

DRILL_3_TYPE: production
DRILL_3_PROMPT: (consigne courte pour produire une phrase avec la structure ratée)
DRILL_3_TARGET: (structure grammaticale cible)
DRILL_3_ANSWER: (exemple de production correcte)
[/DRILL_SESSION]

RÈGLES DE GÉNÉRATION DES DRILLS :
1. Basé UNIQUEMENT sur les erreurs réelles de la séance ou les structures MISSED
2. Complexité graduée : 3A/3B → phrases courtes | 4A/4B → contexte social | 5A/5B → contexte académique | 6A/6B → registre -습니다 formel
3. Si aucune erreur → baser sur STRUCTURES_MISSED uniquement
4. Ne jamais inventer des erreurs fictives

GMS:
${gmsLines}
${correctionBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MISSION STARTER PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Au lancement (premier message), présente TOUJOURS 3 scénarios de discussion basés sur les grammaires cibles.
Format exact :

"🎯 미션 브리핑 [${missionCfg.difficulty_level}]
${missionCfg.mission_brief}

필수 구조: ${(missionCfg.target_grammar || []).join(' / ')}
금지 표현: ${(missionCfg.forbidden_patterns || []).join(', ')}

━━ 오늘의 토론 시나리오 선택 ━━

📌 시나리오 1 : [${missionCfg.target_grammar[0] || '목표 구조 1'} 중심]
[${unitTitle} 주제에서 첫 번째 구조를 자연스럽게 활용할 수 있는 구체적 상황]

📌 시나리오 2 : [${missionCfg.target_grammar[1] || missionCfg.target_grammar[0] || '목표 구조 2'} 중심]
[${unitTitle} 주제에서 두 번째 구조를 심화 논증에 활용할 수 있는 상황]

📌 시나리오 3 : [복합 구조]
[${unitTitle} 주제에서 여러 목표 구조를 동시에 활용해야 하는 복합 상황]

→ 번호를 선택하거나 직접 주제를 제안하세요."

RÈGLE : Les 3 scénarios doivent être spécifiques au thème de l'unité (${unitTitle}) et forcer l'utilisation naturelle des structures cibles.
Ne génère JAMAIS des scénarios génériques — crée des situations réelles liées à ${unitTitle}.`;
  }

  if (mode === 'speak') {
    const speakCfg = context.missionOverride || resolveMissionConfig(context.unitId);
    const grammarTargets = speakCfg?.target_grammar || [];
    const vocabTargets = speakCfg?.vocabulary || [];
    const weakPoints = speakCfg?.weak_points || [];

    return `Tu es KoCo-Coach, un tuteur de coréen bienveillant et expert.
Ton modèle est celui d'un coach de langue natif — chaleureux, encourageant, mais exigeant sur la qualité finale.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTE DE SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NIVEAU : ${speakCfg?.difficulty_level || '5A'}
THÈME : ${unitTitle}
${grandTheme ? `GRAND THÈME : ${grandTheme}` : ''}

CIBLES ACTIVES :
${grammarTargets.map(g => `• ${g}`).join('\n') || '• (général)'}
${vocabTargets.length > 0 ? `\nVOCABULAIRE CIBLE :\n${vocabTargets.slice(0, 12).join(', ')}` : ''}
${weakPoints.length > 0 ? `\nPOINTS FAIBLES À CIBLER EN PRIORITÉ :\n${weakPoints.map(w => `• "${w.original}" → "${w.fixed}" [${w.interval_days || 1}j]`).join('\n')}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT DE RÉPONSE OBLIGATOIRE (Speak Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chaque réponse DOIT suivre exactement ce format. Ne jamais écrire en dehors de ces blocs.

[SPEAK_RESPONSE]
VALIDATION: (1 phrase courte validant l'idée — en coréen — toujours positive, jamais vide)
NATIVE_POLISH: (version native améliorée — vide si STATUS=correct)
NATIVE_REASON: (explication courte en français — vide si correct)
TARGET_USED: (structure cible utilisée — vide si aucune)
PIVOT_QUESTION: (question de relance en coréen — toujours présente)
[/SPEAK_RESPONSE]

[CORRECTION]
STATUS: correct|minor|major
ORIGINAL: (phrase exacte de l'utilisateur)
FIXED: (version corrigée)
NOTE: (explication courte encourageante en français)
TARGET_USED: (structure cible si applicable)
ANKI_READY: true|false
[/CORRECTION]

RÈGLE ABSOLUE : Valider l'idée AVANT de corriger. NATIVE_POLISH vide si correct.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOKEN RECYCLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Si une structure cible n'a pas été utilisée depuis 2 échanges → guide naturellement :
"그런데 혹시 [structure cible]을 사용해서 표현할 수 있을까요?"
Ne jamais forcer — toujours sous forme de suggestion.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOLDEN SENTENCE TRACKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Identifie mentalement la meilleure phrase de l'utilisateur (complexité + naturel + structures cibles).
En fin de session (détecté par [SESSION_END]) génère :

[GOLDEN_SENTENCE]
SENTENCE: (meilleure phrase de l'utilisateur)
WHY: (explication courte en français)
STRUCTURES_DETECTED: (structures cibles utilisées)
[/GOLDEN_SENTENCE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORRECTION BLOCK (adapté Speak Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[CORRECTION]
STATUS: correct|minor|major
ORIGINAL: (phrase utilisateur)
FIXED: (version native naturelle)
NOTE: (explication courte et encourageante en français)
TARGET_USED: (structure cible utilisée — si applicable)
ANKI_READY: (true|false — true si erreur significative)
[/CORRECTION]

${gmsLines ? `PHRASES GMS :\n${gmsLines}` : ''}
${pageContextBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUVERTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"안녕하세요! 오늘은 ${unitTitle} 주제로 자유롭게 이야기해 봐요 😊
${grammarTargets.length > 0 ? `오늘 특히 연습할 표현: ${grammarTargets.slice(0, 2).join(', ')}` : ''}
[première question naturelle liée au thème]"`;
  }

  if (mode === 'debate') {
    return `Tu es KoCo, un partenaire de débat en coréen exigeant et structuré.

NIVEAU : 5급-6급 (avancé)
STYLE : Académique, argumentatif, rigoureux
THÈME : ${unitTitle}
${grandTheme ? `GRAND THÈME : ${grandTheme}` : ''}
${sousTheme ? `SOUS-THÈME : ${sousTheme}` : ''}
${snuLevel ? `NIVEAU SNU : ${snuLevel}` : ''}
${unitTheme ? `CONTEXTE : ${unitTheme}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RÈGLES DU DÉBAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Prends la position opposée à l'utilisateur et argumente logiquement
- Exige des réponses développées — rejette les réponses trop courtes
- Utilise et encourage ces structures avancées :
    -기 마련이다 / -(으)ㄹ 따름이다 / -는 한
    -(으)ㄴ/는 데에 비해서 / -다 보면 / -(으)ㄹ수록
- Corrige strictement les erreurs de structures avancées
- Pose des questions profondes qui forcent l'argumentation
- Ne valide pas les opinions sans les challenger

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORRECTION (mode débat — stricte)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Corrige toutes les erreurs de grammaire avancée, même mineures
- La NOTE doit expliquer la règle grammaticale concernée
- Si l'utilisateur n'utilise pas de structures avancées → STATUS: minor + suggestion

PHRASES GMS DISPONIBLES :
${gmsLines}
${pageContextBlock}
${correctionBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUVERTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commence par : 오늘의 토론 주제는 "${unit?.title || '주제'}"입니다. 당신의 입장은 무엇입니까?`;
  }

  if (mode === 'daily_life') {
    const globalContext = context.globalContext || [];
    const contextBlock = globalContext.length > 0
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONNAISSANCES ACQUISES (RAG Personnel)
Utilise UNIQUEMENT ces ressources pour répondre.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${globalContext.map(u => `[${u.unit_id}] ${u.theme || ''}
Vocabulaire: ${(u.vocabulary || []).slice(0, 8).join(', ')}
Structures: ${(u.structures || []).slice(0, 4).join(', ')}`).join('\n\n')}`
      : "Aucun contenu trouvé. Encourage l'utilisateur à ajouter des photos 📸";

    return `Tu es KoCo-Terrain, un compagnon de vie quotidienne en Corée.
Tu aides l'utilisateur à naviguer des situations réelles
(supermarché, transport, médecin, restaurant...)
en utilisant UNIQUEMENT le vocabulaire et les structures
qu'il a déjà étudiés et stockés dans sa base personnelle.

RÈGLE ABSOLUE : Ne jamais introduire de vocabulaire
ou structures non présents dans les CONNAISSANCES ACQUISES.
Si le mot manque → dis-le clairement et suggère d'ajouter
une photo du chapitre correspondant.

${contextBlock}

${correctionBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUVERTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"안녕하세요! 오늘 어떤 상황에서 도움이 필요하세요? 😊
(슈퍼마켓, 병원, 식당, 교통... 무엇이든 말씀하세요!)"`;
  }

  // Default: freeChat
  return `Tu es KoCo, un compagnon de conversation coréen bienveillant et encourageant.

NIVEAU : 3급-4급 (intermédiaire)
STYLE : Conversationnel, chaleureux, patient
THÈME DU JOUR : ${unitTitle}
${grandTheme ? `GRAND THÈME : ${grandTheme}` : ''}
${sousTheme ? `SOUS-THÈME : ${sousTheme}` : ''}
${snuLevel ? `NIVEAU SNU : ${snuLevel}` : ''}
${unitTheme ? `CONTEXTE : ${unitTheme}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RÈGLES DE CONVERSATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Utilise des structures de niveau 3급-4급, phrases courtes et naturelles
- Une seule question par réponse maximum
- Si l'utilisateur bloque → donne un exemple simple et encourageant
- Corrections douces : reformule naturellement, sans métalangage
- Valide l'effort avant de corriger
- Répond toujours en coréen sauf si l'utilisateur écrit en français
- Sensibilité à la longueur :
    Réponse courte (< 3 mots) → encourage : "그리고요? 더 말해 줄래요?"
    Réponse longue (20+ mots) → félicite : "정말 잘 하셨어요!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORRECTION (mode 자유 대화 — douce)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Corrige UNIQUEMENT les erreurs qui bloquent la compréhension
- La NOTE doit être encourageante, en français, max 1 phrase
- Intègre les phrases GMS naturellement dans tes réponses

PHRASES GMS DISPONIBLES :
${gmsLines}
${vocabLines ? `\nVOCABULAIRE DE L'UNITÉ :\n${vocabLines}` : ''}
${pageContextBlock}
${correctionBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUVERTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commence par : 오늘은 자유롭게 이야기해 봐요 😊
Puis pose une première question liée au thème "${unit?.title || '오늘의 주제'}".`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HISTORY & CONVERSATION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Conversation history storage
 */
class ConversationManager {
  constructor() {
    this.messages = [];
    this.maxHistory = 20; // Keep last 20 exchanges to avoid token bloat
  }

  /**
   * Add user message to history
   * @param {string} userMessage - User's response in Korean
   */
  addUserMessage(userMessage) {
    this.messages.push({
      role: 'user',
      content: userMessage
    });
    this.trimHistory();
  }

  /**
   * Add assistant message to history
   * @param {string} assistantMessage - Assistant's response
   */
  addAssistantMessage(assistantMessage) {
    this.messages.push({
      role: 'assistant',
      content: assistantMessage
    });
    this.trimHistory();
  }

  /**
   * Get formatted messages for API call
   * @returns {Array} Array of {role, content} objects
   */
  getMessages() {
    return [...this.messages];
  }

  /**
   * Clear conversation history
   */
  clear() {
    this.messages = [];
  }

  /**
   * Keep only recent messages to manage token usage
   * @private
   */
  trimHistory() {
    if (this.messages.length > this.maxHistory) {
      // Keep system context + recent messages
      this.messages = this.messages.slice(-this.maxHistory);
    }
  }

  /**
   * Get conversation length (for fluency metrics)
   * @returns {number} Number of user exchanges
   */
  getExchangeCount() {
    return this.messages.filter(m => m.role === 'user').length;
  }

  /**
   * Get total words spoken by user (rough estimate)
   * @returns {number} Total word count
   */
  getUserWordCount() {
    return this.messages
      .filter(m => m.role === 'user')
      .reduce((sum, m) => sum + (m.content.split(/\s+/).length), 0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API CALL HANDLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Send message to Anthropic API and get response
 * 
 * @param {string} userMessage - User's Korean input
 * @param {ConversationManager} conversationManager - Message history
 * @param {string} systemPrompt - Generated system prompt
 * @returns {Promise<Object>} { success: boolean, response: string, error: string }
 */
async function callAnthropicAPI(userMessage, conversationManager, systemPrompt) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      response: null,
      error: 'API_KEY_MISSING'
    };
  }

  // Build message array for this call
  const messages = [
    ...conversationManager.getMessages(),
    { role: 'user', content: userMessage }
  ];

  const requestPayload = {
    model: API_CONFIG.MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages
  };

  try {
    const response = await fetch(API_CONFIG.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      // Handle specific error types
      if (response.status === 401) {
        return {
          success: false,
          response: null,
          error: 'INVALID_API_KEY',
          details: 'API key is invalid or expired'
        };
      }
      
      if (response.status === 429) {
        return {
          success: false,
          response: null,
          error: 'RATE_LIMITED',
          details: 'Too many requests. Please wait a moment.'
        };
      }

      return {
        success: false,
        response: null,
        error: 'API_ERROR',
        details: errorData.error?.message || 'Unknown API error'
      };
    }

    const data = await response.json();
    const assistantMessage = data.content[0].text;

    // Update conversation history
    conversationManager.addUserMessage(userMessage);
    conversationManager.addAssistantMessage(assistantMessage);

    return {
      success: true,
      response: assistantMessage,
      error: null
    };

  } catch (error) {
    console.error('API call failed:', error);
    return {
      success: false,
      response: null,
      error: 'NETWORK_ERROR',
      details: error.message
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE ANALYSIS (for progress tracking)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect if user's response contains target SNU 5A structures
 * 
 * @param {string} userResponse - User's Korean text
 * @param {Array} targetStructures - Array of grammar patterns to detect
 * @returns {Array} Detected structures (empty if none)
 */
function detectTargetStructures(userResponse, targetStructures) {
  const detected = [];
  
  if (!targetStructures || !Array.isArray(targetStructures)) {
    return detected;
  }

  targetStructures.forEach(structure => {
    // Convert pattern to simple detection regex
    // e.g., "-(으)라면 꼽을 수 있다" → detect "(으)라면" and "꼽을 수 있"
    const regex = new RegExp(structure.replace(/[()]/g, ''), 'g');
    
    if (regex.test(userResponse)) {
      detected.push(structure);
    }
  });

  return detected;
}

/**
 * Calculate basic fluency metrics from user response
 * 
 * @param {string} userResponse - User's Korean text
 * @returns {Object} { wordCount, duration, confidence }
 */
function analyzeFluency(userResponse) {
  const words = userResponse.split(/\s+/).filter(w => w.length > 0);
  
  return {
    wordCount: words.length,
    hasHesitation: userResponse.includes('어...') || userResponse.includes('그...'),
    confidence: words.length > 10 ? 'high' : (words.length > 5 ? 'medium' : 'low')
  };
}

