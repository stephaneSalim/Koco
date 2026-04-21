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
function generateSystemPrompt(context, mode, gmsSentences) {
  const { unit, vocabulary } = context;

  const unitTitle = unit ? `${unit.title} — ${unit.subtitle}` : '자유 주제';
  const unitTheme = unit?.theme || '';

  const gmsLines = gmsSentences && gmsSentences.length > 0
    ? gmsSentences.map(s => `  • ${s.text_kr} — ${s.text_en}`).join('\n')
    : '  (없음)';

  const vocabLines = vocabulary && vocabulary.length > 0
    ? vocabulary.slice(0, 8).map(v => `  • ${v.korean} (${v.meaning})`).join('\n')
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

  if (mode === 'debate') {
    return `Tu es KoCo, un partenaire de débat en coréen exigeant et structuré.

NIVEAU : 5급-6급 (avancé)
STYLE : Académique, argumentatif, rigoureux
THÈME : ${unitTitle}
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
${correctionBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUVERTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commence par : 오늘의 토론 주제는 "${unit?.title || '주제'}"입니다. 당신의 입장은 무엇입니까?`;
  }

  // Default: freeChat
  return `Tu es KoCo, un compagnon de conversation coréen bienveillant et encourageant.

NIVEAU : 3급-4급 (intermédiaire)
STYLE : Conversationnel, chaleureux, patient
THÈME DU JOUR : ${unitTitle}
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

