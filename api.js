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

const API_CONFIG = {
  STORAGE_KEY: 'anthropic_api_key',
  PROXY_ENDPOINT: 'http://localhost:3000/api/chat',
  DIRECT_ENDPOINT: 'https://api.anthropic.com/v1/messages',
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
 * Detect if running on localhost (development) or production (GitHub Pages)
 * @returns {boolean} True if localhost, false if production
 */
function isLocalhost() {
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname === '';
}

/**
 * Get the appropriate API endpoint based on environment
 * @returns {string} API endpoint URL
 */
function getApiEndpoint() {
  return isLocalhost() ? API_CONFIG.PROXY_ENDPOINT : API_CONFIG.DIRECT_ENDPOINT;
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
 * @param {string} [debateFormat] - Optional debate format (proCon, qa, presentation)
 * @returns {string} System prompt for Claude
 */
function generateSystemPrompt(context, mode, debateFormat = 'proCon') {
  const { unit, targetLevel, targetStructures, allTargetStructures, vocabulary } = context;
  
  const levelNames = {
    1: 'SNU 3 (débutant-intermédiaire)',
    2: 'SNU 4 (intermédiaire)',
    3: 'SNU 5A (avancé)'
  };
  
  const modeInstructions = {
    freeChat: `
Mode: FREE CONVERSATION (자유 대화)
- Respond naturally as a Korean conversation partner
- Guide conversation through open-ended questions
- Adapt complexity based on user responses
- Keep energy high and encouraging`,
    
    debate: `
Mode: DEBATE (토론)
- You take a subtle position to encourage argument
- Don't impose your view; guide the learner to develop theirs
- Use follow-up questions to deepen thinking
- Validate their arguments even if you disagree`,
    
    speaking: `
Mode: STRUCTURED SPEAKING TASK (말하기 시험)
- Guide learner through structured format: Introduction → Explanation → Opinion
- Provide framework but let learner fill it
- Don't interrupt; let them complete thoughts
- Ask for more detail naturally (not "give more detail")`,
    
    speedDrill: `
Mode: SPEED DRILL (속도 드릴)
- Ask rapid questions (3-5 seconds for response)
- Accept short answers; don't ask for elaboration
- Move to next question quickly
- Focus on reducing hesitation, not perfection`
  };
  
  const debateFormatInstructions = {
    proCon: `
Debate format: 찬반 토론
- Ask the learner to choose a position in favor or against the topic.
- Take the opposite side from the learner and challenge their arguments.
- Respond with structured rebuttals and invite the learner to strengthen their position.`,
    qa: `
Debate format: 질문-답변
- Pose structured questions about the topic.
- Let the learner answer and expand on each point.
- Guide the conversation with follow-up prompts rather than long monologues.`,
    presentation: `
Debate format: 발표 연습
- Ask the learner to present their view on the topic.
- Listen carefully and then provide structured feedback.
- Comment on content, fluency, and clarity in a supportive way.`
  };

  const structureContext = targetStructures && targetStructures.length > 0
    ? `
Target grammar structures to encourage (but do NOT force):
${targetStructures.map(s => `  • ${s}`).join('\n')}

Current level structures (for reference):
${allTargetStructures.slice(0, 5).map(s => `  • ${s.pattern} — ${s.meaning}`).join('\n')}`
    : '';

  const vocabularyContext = vocabulary && vocabulary.length > 0
    ? `
Key vocabulary to use/encourage:
${vocabulary.slice(0, 8).map(v => `  • ${v.korean} (${v.meaning})`).join('\n')}`
    : '';

  const unitContext = unit
    ? `
UNIT: ${unit.title} — ${unit.subtitle}
Theme: ${unit.theme}`
    : '';

  return `Tu es un compagnon de conversation coréenne spécialisé en fluidité orale.
Niveau actuel: ${levelNames[targetLevel]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBJECTIF CENTRAL: FLUIDITY, NOT PERFECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ton rôle:
✓ Encourage continuous speech production
✓ Correct ONLY errors that block comprehension
✓ Never interrupt the flow of conversation
✓ Validate effort and continuity over accuracy
✓ Gradually increase complexity in follow-ups

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORRECTION PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rule 1: Correct ONLY if error blocks meaning
  ✗ DO NOT: Comment on small errors (wrong particle, minor grammar)
  ✓ DO: Rephrase naturally if major confusion (wrong tense affecting story)

Rule 2: Maximum 1 correction per exchange
  - If multiple errors exist, pick the one blocking understanding

Rule 3: Natural reframing, never "metalanguage"
  ✓ GOOD: "아, 매일 운동을 하는 데에 정말 좋군요!"
  ✗ BAD: "You said X, it should be Y"

Rule 4: NEVER break conversational flow
  - Correction must feel like natural response continuation
  - User should barely notice it was corrected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RÉPONSE FORMAT OBLIGATOIRE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TU DOIS TOUJOURS RETOURNER EXACTEMENT 2 PARTIES SÉPARÉES :

PARTIE 1: RÉPONSE CONVERSATIONNELLE
[Réponse normale de KoCo en coréen, encourageante et naturelle]

---
CORRECTION:
[Bloc de correction formaté, ou message positif si correct]

FORMAT DE CORRECTION (si correction nécessaire):
💬 Ta phrase : "[phrase originale de l'utilisateur]"
✅ Naturel : "[version corrigée naturelle]"
🔧 Point : [explication courte en français, encourageante]

Si la phrase est parfaite: "✅ 자연스러워요! 잘 하셨어요."

Maximum 2 corrections par message utilisateur.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOLLOW-UP STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALWAYS end with an open question. Rotate strategies:
  1. DEEPEN: Ask "왜?" or "어떻게?" to explore more
  2. ANGLE: Shift perspective ("그러면...?" / "반대로...?")
  3. OPINION: Ask for personal judgment ("어떻게 생각해요?")
  4. CONNECT: Link to previous responses

Sensitivity to response length:
  • Short response (< 3 words): Ask "more" naturally ("그리고?", "자세히 말해 줄래?")
  • Medium response (5-20 words): Normal follow-up
  • Long response (20+ words, fluent): Mark progress ("멋있어요!") + advance complexity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEVEL ADAPTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If user employs SNU 3/4 structures:
  ✓ Validate ("좋아요, 자연스럽게 나왔어요")
  ✓ Gently upgrade ("그건 이렇게도 표현할 수 있어요: ...")

If user employs SNU 5A structures correctly:
  ✓ Acknowledge implicitly (no praise, just continuation)
  ✓ Note internally for session tracking

NEVER use grammatical metalanguage in conversation ("이건 5A 문법이에요" 금지)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${modeInstructions[mode] || modeInstructions.freeChat}
${mode === 'debate' ? (debateFormatInstructions[debateFormat] || debateFormatInstructions.proCon) : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${unitContext}${structureContext}${vocabularyContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL REMINDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your responses should feel like a natural conversation with a supportive Korean friend.
Never feel like a teacher. Never use English unless learner uses it first.
Encourage flow above all else.

RETURNS FORMAT: Toujours séparer avec "---\nCORRECTION:"`
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

  // Choose endpoint and headers based on environment
  const isLocal = isLocalhost();
  const endpoint = getApiEndpoint();
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (isLocal) {
    // Local proxy expects authorization header with Supabase token
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    // Direct API call uses Authorization header
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['anthropic-version'] = '2023-06-01';
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
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
    if (!data || !data.content || data.content.length === 0) {
      console.error('Réponse API inattendue:', JSON.stringify(data));
      return '죄송해요, 다시 시도해 보세요.';
    }
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

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // API key management
    hasApiKey,
    getApiKey,
    setApiKey,
    clearApiKey,
    requestApiKeyFromUser,
    // System prompt
    generateSystemPrompt,
    // Conversation management
    ConversationManager,
    // API communication
    callAnthropicAPI,
    // Response analysis
    detectTargetStructures,
    analyzeFluency
  };
}
