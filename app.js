/**
 * KoCo — Korean Conversation Companion
 * app.js — Application logic, modes, speech recognition, localStorage, 3-level navigation
 */

//#region App state
const STATE = {
  mode: 'freeChat',
  unitId: 'unit_1_1',
  lessonId: null, // For future multi-lesson units
  isListening: false,
  isProcessing: false,
  usedQuestions: {
    freeChat: new Set(),
    debate: new Set(),
    speaking: new Set(),
    speedDrill: new Set()
  },
  session: {
    sessionStart: null,
    exchangeCount: 0,
    totalUserWords: 0,
    totalUserResponses: 0,
    structureHits: new Set()
  }
};

const STORAGE_KEYS = {
  progress: 'koco_progress',
  fluencySessions: 'koco_fluency_sessions',
  apiKey: 'anthropic_api_key',
  ttsEnabled: 'koco_tts_enabled',
  inputMode: 'koco_input_mode',
  selectedUnit: 'koco_selected_unit',
  selectedLesson: 'koco_selected_lesson'
};

const MODE_INFO = {
  freeChat: { icon: '💬', label: '자유 대화' },
  debate: { icon: '⚖️', label: '토론' },
  speaking: { icon: '🗣️', label: '말하기 시험' },
  speedDrill: { icon: '⚡', label: '속도 드릴' }
};

let conversationManager;
let recognition;
let selectedVoice = null;
let hasProcessedFinalResult = false; // Track if we've already processed a final result in current session
let audioContextUnlocked = false; // Track if audio context has been unlocked for TTS
let lastInterimText = ''; // Store last interim text for Samsung/Android fallback
let silenceTimeout = null; // Timeout for silence detection

//#endregion

//#region Debug Panel
function toggleDebugPanel() {
  const panel = document.getElementById('debugPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function addDebugEntry(event, details = '') {
  const debugContent = document.getElementById('debugContent');
  if (!debugContent) return;

  const timestamp = new Date().toLocaleTimeString('fr-FR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 1
  });

  const entry = document.createElement('div');
  entry.className = 'debug-panel__entry';
  entry.innerHTML = `
    <span class="debug-panel__timestamp">[${timestamp}]</span>
    <strong>${event}:</strong> ${details}
  `;

  debugContent.appendChild(entry);
  debugContent.scrollTop = debugContent.scrollHeight;

  // Keep only last 20 entries
  while (debugContent.children.length > 20) {
    debugContent.removeChild(debugContent.firstChild);
  }
}

//#endregion

//#region DOM Elements
const elements = {
  // Header
  headerBranding: document.getElementById('headerLessonTitle'),
  headerLessonTitle: document.getElementById('headerLessonTitle'),
  headerLessonTheme: document.getElementById('headerLessonTheme'),
  headerModeBadge: document.getElementById('headerModeBadge'),
  progressBarFill: document.getElementById('progressBarFill'),

  // Navigation
  unitScroller: document.getElementById('unitScroller'),
  lessonScroller: document.getElementById('lessonScroller'),

  // Input
  inputModeBtns: document.querySelectorAll('.input-mode-btn'),
  inputAreaVoice: document.querySelector('.input-area--voice'),
  inputAreaText: document.querySelector('.input-area--text'),
  textInput: document.querySelector('.text-input'),
  textSendBtn: document.querySelector('.text-send-btn'),

  // Conversation
  conversation: document.querySelector('.conversation'),
  transcription: document.querySelector('.transcription'),
  transcriptionIndicator: document.querySelector('.transcription__indicator'),
  micButton: document.querySelector('.mic-button'),
  micStatus: document.querySelector('.mic-status'),

  // Navigation & UI
  navTabs: Array.from(document.querySelectorAll('.nav-tab')),
  ttsToggle: document.querySelector('.tts-toggle'),
  fluencyBadge: document.querySelector('.fluency-badge'),
  apiModal: document.querySelector('.modal-overlay'),
  apiInput: document.querySelector('.modal__input'),
  apiSaveButton: document.querySelector('.modal__button--primary'),
  apiCancelButton: document.querySelector('.modal__button--secondary'),
  alertArea: document.querySelector('.alert-area'),
  typingIndicator: document.querySelector('.typing-indicator'),
  nextQuestionButton: document.querySelector('.next-question-btn')
};

//#endregion

//#region Navigation 3-Level System

/**
 * Generate unit selector pills from UNITS data
 */
function generateUnitSelector() {
  const unitIds = Object.keys(UNITS);
  const progress = getProgressData();

  elements.unitScroller.innerHTML = '';

  unitIds.forEach(unitId => {
    const unit = UNITS[unitId];
    const pill = document.createElement('button');
    pill.className = 'unit-pill';
    pill.dataset.unitId = unitId;
    pill.textContent = unit.title;

    // Mark as active if this is the current unit
    if (unitId === STATE.unitId) {
      pill.classList.add('active');
    }

    // Mark as completed if user has finished this unit
    if (progress.completedUnits[unitId]) {
      pill.classList.add('completed');
    }

    pill.addEventListener('click', () => selectUnit(unitId));
    elements.unitScroller.appendChild(pill);
  });
}

/**
 * Generate lesson selector cards for current unit
 */
function generateLessonSelector() {
  const unit = UNITS[STATE.unitId];
  if (!unit) return;

  elements.lessonScroller.innerHTML = '';

  // For now, units have single lesson. Future: support multiple lessons per unit
  const lessonId = STATE.unitId; // Lesson ID matches unit ID for now
  const card = document.createElement('button');
  card.className = 'lesson-card';
  card.dataset.lessonId = lessonId;

  // Special styling for merged units
  if (STATE.unitId.includes('merged')) {
    card.classList.add('merged');
  }

  card.innerHTML = `
    <span class="lesson-card__title">${unit.title}</span>
    <span class="lesson-card__theme">${unit.subtitle}</span>
  `;

  // Mark as active
  card.classList.add('active');

  // Mark as completed if unit is completed
  const progress = getProgressData();
  if (progress.completedUnits[STATE.unitId]) {
    card.classList.add('completed');
  }

  card.addEventListener('click', () => selectLesson(lessonId));
  elements.lessonScroller.appendChild(card);
}

/**
 * Select a unit and update UI
 */
function selectUnit(unitId) {
  if (!UNITS[unitId]) return;

  // Update state
  STATE.unitId = unitId;
  STATE.lessonId = unitId; // For now, lesson = unit

  // Save to localStorage
  localStorage.setItem(STORAGE_KEYS.selectedUnit, unitId);
  localStorage.setItem(STORAGE_KEYS.selectedLesson, unitId);

  // Update UI
  updateUnitSelector();
  generateLessonSelector();
  updateHeader();
  updateProgressBar();

  // Reset conversation and questions for new unit
  resetConversationForNewUnit();

  addDebugEntry('navigation', `Unité sélectionnée: ${unitId}`);
}

/**
 * Select a lesson and update UI
 */
function selectLesson(lessonId) {
  if (lessonId !== STATE.unitId) return; // For now, only one lesson per unit

  STATE.lessonId = lessonId;

  // Save to localStorage
  localStorage.setItem(STORAGE_KEYS.selectedLesson, lessonId);

  // Update UI
  updateLessonSelector();
  updateHeader();
  updateProgressBar();

  // Reset conversation and questions for new lesson
  resetConversationForNewUnit();

  addDebugEntry('navigation', `Leçon sélectionnée: ${lessonId}`);
}

/**
 * Update unit selector active state
 */
function updateUnitSelector() {
  const pills = elements.unitScroller.querySelectorAll('.unit-pill');
  pills.forEach(pill => {
    if (pill.dataset.unitId === STATE.unitId) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

/**
 * Update lesson selector active state
 */
function updateLessonSelector() {
  const cards = elements.lessonScroller.querySelectorAll('.lesson-card');
  cards.forEach(card => {
    if (card.dataset.lessonId === STATE.lessonId) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

/**
 * Update header with current lesson context
 */
function updateHeader() {
  const unit = UNITS[STATE.unitId];
  if (!unit) return;

  elements.headerLessonTitle.textContent = unit.title;
  elements.headerLessonTheme.textContent = unit.subtitle;
  elements.headerModeBadge.textContent = MODE_INFO[STATE.mode].label;

  addDebugEntry('header', `Mis à jour: ${unit.title} - ${MODE_INFO[STATE.mode].label}`);
}

/**
 * Update progress bar based on exchange count
 */
function updateProgressBar() {
  const progress = Math.min((STATE.session.exchangeCount / 10) * 100, 100); // 10 exchanges = 100%
  elements.progressBarFill.style.width = `${progress}%`;

  addDebugEntry('progress', `Barre de progression: ${progress}% (${STATE.session.exchangeCount}/10 échanges)`);
}

/**
 * Reset conversation and questions when switching units/lessons
 */
function resetConversationForNewUnit() {
  // Clear conversation
  elements.conversation.innerHTML = '';

  // Reset session counters for new unit
  STATE.session.exchangeCount = 0;
  STATE.session.totalUserWords = 0;
  STATE.session.totalUserResponses = 0;
  STATE.session.structureHits.clear();

  // Reset used questions for all modes
  Object.keys(STATE.usedQuestions).forEach(mode => {
    STATE.usedQuestions[mode].clear();
  });

  // Start with first question
  nextQuestion();
  updateProgressBar();

  addDebugEntry('reset', `Conversation réinitialisée pour ${STATE.unitId}`);
}

/**
 * Load saved navigation position on app start
 */
function loadSavedNavigationPosition() {
  const savedUnit = localStorage.getItem(STORAGE_KEYS.selectedUnit);
  const savedLesson = localStorage.getItem(STORAGE_KEYS.selectedLesson);

  if (savedUnit && UNITS[savedUnit]) {
    STATE.unitId = savedUnit;
  }

  if (savedLesson) {
    STATE.lessonId = savedLesson;
  }

  addDebugEntry('load', `Position chargée: unit=${STATE.unitId}, lesson=${STATE.lessonId}`);
}

//#endregion

//#region Utility: localStorage progress + sessions
function getProgressData() {
  const raw = localStorage.getItem(STORAGE_KEYS.progress);
  return raw ? JSON.parse(raw) : { completedUnits: {}, structures: {} };
}

function saveProgressData(data) {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(data));
}

function getFluencySessions() {
  const raw = localStorage.getItem(STORAGE_KEYS.fluencySessions);
  return raw ? JSON.parse(raw) : [];
}

function saveFluencySessions(sessions) {
  localStorage.setItem(STORAGE_KEYS.fluencySessions, JSON.stringify(sessions));
}

function recordFluencySession(score, userWords, exchanges) {
  const sessions = getFluencySessions();
  sessions.unshift({
    date: new Date().toISOString(),
    score,
    userWords,
    exchanges
  });
  localStorage.setItem(STORAGE_KEYS.fluencySessions, JSON.stringify(sessions.slice(0, 5)));
}

//#endregion

//#region Text-to-Speech (TTS)
function isTtsEnabled() {
  return localStorage.getItem(STORAGE_KEYS.ttsEnabled) === 'true';
}

function setTtsEnabled(enabled) {
  localStorage.setItem(STORAGE_KEYS.ttsEnabled, enabled === true ? 'true' : 'false');
  updateTtsButton();
}

function initVoice() {
  const voices = window.speechSynthesis.getVoices();
  const koVoices = voices.filter(v => v.lang.startsWith('ko'));

  if (koVoices.length === 0) {
    console.warn('No Korean voice available');
    selectedVoice = null;
    return;
  }

  // Priority: female native Korean voices
  const preferredNames = ['female', 'Google 한국의', 'Yuna', 'Heami'];
  for (const name of preferredNames) {
    const voice = koVoices.find(v => v.name.includes(name));
    if (voice) {
      selectedVoice = voice;
      return;
    }
  }

  // Fallback: use first available Korean voice
  selectedVoice = koVoices[0];
}

function speak(text) {
  if (!isTtsEnabled() || !text || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  // iOS requires a small delay before speaking
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const delay = isIOS ? 100 : 0;

  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, delay);
}

function unlockAudioContext() {
  if (audioContextUnlocked || !window.speechSynthesis) return;

  // Play a silent utterance to unlock audio context on mobile
  const silentUtterance = new SpeechSynthesisUtterance('');
  silentUtterance.volume = 0;
  silentUtterance.onend = () => {
    audioContextUnlocked = true;
  };

  window.speechSynthesis.speak(silentUtterance);
}

function updateTtsButton() {
  if (!elements.ttsToggle) return;

  if (isTtsEnabled()) {
    elements.ttsToggle.classList.add('tts-toggle--active');
    elements.ttsToggle.setAttribute('title', '음성 합성 켜짐');
  } else {
    elements.ttsToggle.classList.remove('tts-toggle--active');
    elements.ttsToggle.setAttribute('title', '음성 합성 꺼짐');
  }
}

//#endregion

//#region Input Mode Management
function getInputMode() {
  return localStorage.getItem(STORAGE_KEYS.inputMode) || 'voice';
}

function setInputMode(mode) {
  localStorage.setItem(STORAGE_KEYS.inputMode, mode);
  updateInputMode();
}

function updateInputMode() {
  const currentMode = getInputMode();

  // Update button states
  elements.inputModeBtns.forEach(btn => {
    if (btn.dataset.mode === currentMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update input areas
  if (currentMode === 'voice') {
    elements.inputAreaVoice.classList.add('active');
    elements.inputAreaText.classList.remove('active');
    // Reset mic state when switching to voice mode
    if (!STATE.isProcessing) {
      setMicState('idle');
    }
  } else {
    elements.inputAreaVoice.classList.remove('active');
    elements.inputAreaText.classList.add('active');
    // Stop any ongoing voice recognition when switching to text mode
    if (STATE.isListening) {
      stopListening();
    }
  }
}

function sendTextInput() {
  const text = elements.textInput.value.trim();
  if (!text || STATE.isProcessing) return;

  // Disable send button during processing
  elements.textSendBtn.disabled = true;

  // Send to API (same logic as voice input)
  processUserInput(text);

  // Clear input
  elements.textInput.value = '';
  elements.textInput.focus();

  // Re-enable send button after processing starts
  setTimeout(() => {
    elements.textSendBtn.disabled = false;
  }, 100);
}

//#endregion

//#region UI helpers
function showAlert(type, text) {
  const html = `
    <div class="alert alert--${type}">
      ${text}
    </div>
  `;
  elements.alertArea.innerHTML = html;
  setTimeout(() => {
    elements.alertArea.innerHTML = '';
  }, 4200);
}

function addMessage(role, text) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', `message--${role}`);

  const avatar = document.createElement('div');
  avatar.classList.add('message__avatar');
  avatar.textContent = role === 'user' ? '나' : '코코';

  const content = document.createElement('div');
  content.classList.add('message__content');
  content.textContent = text;

  wrapper.appendChild(avatar);
  wrapper.appendChild(content);
  elements.conversation.appendChild(wrapper);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;

  // Update progress after each exchange
  updateProgressBar();
}

function showTypingIndicator(show) {
  elements.typingIndicator.style.display = show ? 'flex' : 'none';
  if (show) elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function setMicState(state) {
  elements.micButton.classList.remove('listening');
  elements.micButton.disabled = false;
  if (state === 'listening') {
    elements.micButton.classList.add('listening');
    elements.micStatus.textContent = '듣는 중...';
  } else if (state === 'processing') {
    elements.micStatus.textContent = '처리 중...';
  } else {
    elements.micStatus.textContent = '마이크 시작';
  }
}

function updateNav() {
  elements.navTabs.forEach(tab => {
    if (tab.dataset.mode === STATE.mode) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

function updateFluencyIndicator() {
  const totalWords = STATE.session.totalUserWords;
  const exchanges = STATE.session.totalUserResponses;
  const avg = exchanges === 0 ? 0 : Math.round(totalWords / exchanges);

  let badgeClass = 'fluency-badge--low';
  let label = '유창성: 짧음';

  if (avg > 15) {
    badgeClass = 'fluency-badge--high';
    label = '유창성: 길음';
  } else if (avg > 7) {
    badgeClass = 'fluency-badge--medium';
    label = '유창성: 중간';
  }

  elements.fluencyBadge.className = `fluency-badge ${badgeClass}`;
  elements.fluencyBadge.querySelector('#fluencyText').textContent = label;
}

function setQuestion(prompt) {
  addMessage('assistant', prompt);
}

function nextQuestion() {
  const unit = UNITS[STATE.unitId];
  if (!unit) return;

  const questions = unit.questions[STATE.mode];
  if (!questions || questions.length === 0) return;

  const used = STATE.usedQuestions[STATE.mode];
  if (used.size === questions.length) {
    used.clear();
  }

  let candidate;
  do {
    candidate = questions[Math.floor(Math.random() * questions.length)];
  } while (used.has(candidate) && used.size < questions.length);

  used.add(candidate);
  setQuestion(candidate);
}

function updateMode(newMode) {
  if (!MODE_INFO[newMode]) return;

  STATE.mode = newMode;
  STATE.usedQuestions[newMode] = STATE.usedQuestions[newMode] || new Set();
  updateHeader();
  updateNav();
  nextQuestion();
}

//#endregion

//#region Speech recognition setup
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showAlert('error', '이 브라우저는 Web Speech API를 지원하지 않습니다. Chrome을 사용하세요.');
    elements.micButton.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    addDebugEntry('onstart', 'micro démarré');
    STATE.isListening = true;
    hasProcessedFinalResult = false; // Reset for new recognition session
    lastInterimText = ''; // Reset interim text
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }
    setMicState('listening');
    elements.transcriptionIndicator.textContent = '음성 인식 중...';
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();
      if (result.isFinal) {
        final += transcript + ' ';
      } else {
        interim += transcript + ' ';
      }
    }

    // Log result details
    const resultText = final || interim;
    const isFinal = final ? 'true' : 'false';
    addDebugEntry('onresult', `isFinal: ${isFinal} — texte: "${resultText}"`);

    elements.transcription.textContent = final || interim;
    elements.transcription.classList.toggle('transcription--interim', !!interim && !final);

    // Store last interim text for fallback
    if (interim) {
      lastInterimText = interim.trim();
    }

    // Clear existing timeout and set new one for silence detection
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
    }
    silenceTimeout = setTimeout(() => {
      if (lastInterimText && !hasProcessedFinalResult) {
        // Samsung/Android fallback: send last interim text after 1500ms silence
        addDebugEntry('timeout', `envoi automatique après 1500ms: "${lastInterimText}"`);
        hasProcessedFinalResult = true;
        processUserInput(lastInterimText);
        elements.transcription.textContent = '';
        lastInterimText = '';

        // Restart recognition after processing
        setTimeout(() => {
          if (!STATE.isProcessing) {
            startListening();
          }
        }, 100);
      }
    }, 1500);

    // Only process final results, and only once per recognition session
    if (final && !hasProcessedFinalResult) {
      hasProcessedFinalResult = true;
      clearTimeout(silenceTimeout); // Clear the fallback timeout
      processUserInput(final.trim());
      elements.transcription.textContent = '';
      lastInterimText = '';

      // Restart recognition after processing
      setTimeout(() => {
        if (!STATE.isProcessing) {
          startListening();
        }
      }, 100);
    }
  };

  recognition.onerror = (event) => {
    addDebugEntry('onerror', `erreur: ${event.error}`);
    console.error('Speech recognition error', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showAlert('error', '마이크 접근이 거부되었습니다. 브라우저 설정을 확인하세요.');
      stopListening();
      setMicState('idle');
      return;
    }

    showAlert('warning', `음성 인식 오류: ${event.error}`);
  };

  recognition.onend = () => {
    addDebugEntry('onend', 'micro arrêté');
    STATE.isListening = false;

    // Clear any pending silence timeout
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }

    // Samsung/Android fallback: if we have interim text that wasn't processed, send it
    if (lastInterimText && !hasProcessedFinalResult) {
      addDebugEntry('onend', `envoi texte restant: "${lastInterimText}"`);
      hasProcessedFinalResult = true;
      processUserInput(lastInterimText);
      elements.transcription.textContent = '';
      lastInterimText = '';
    }

    if (STATE.isProcessing) {
      // Keep in processing state until API response.
      return;
    }
    setMicState('idle');
    elements.transcriptionIndicator.textContent = '마이크 정지';
  };
}

function startListening() {
  if (!recognition || STATE.isListening) return;
  try {
    recognition.start();
  } catch (error) {
    console.warn('Unable to start recognition', error);
  }
}

function stopListening() {
  if (!recognition || !STATE.isListening) return;

  // Clear any pending silence timeout
  if (silenceTimeout) {
    clearTimeout(silenceTimeout);
    silenceTimeout = null;
  }

  recognition.stop();
}

function toggleListening() {
  if (STATE.isListening) {
    stopListening();
  } else {
    // Unlock audio context on first mic click (for mobile TTS)
    unlockAudioContext();
    startListening();
  }
}

//#endregion

//#region API interaction + conversation flow
async function processUserInput(text) {
  if (!text) return;

  // Add user message to the UI
  addMessage('user', text);

  // Fluency metrics update
  const fluency = analyzeFluency(text);
  STATE.session.totalUserWords += fluency.wordCount;
  STATE.session.totalUserResponses += 1;
  STATE.session.exchangeCount += 1;

  const unitContext = UNITS[STATE.unitId];
  const context = getSessionContext(STATE.unitId, parseInt(unitContext?.snu_level?.[3] || '3', 10) || 3);
  const systemPrompt = generateSystemPrompt(context, STATE.mode);

  STATE.isProcessing = true;
  if (getInputMode() === 'voice') {
    setMicState('processing');
  }
  showTypingIndicator(true);

  try {
    const result = await callAnthropicAPI(text, conversationManager, systemPrompt);

    if (!result.success) {
      if (result.error === 'INVALID_API_KEY') {
        showAlert('error', 'API 키가 잘못되었습니다. 다시 입력해주세요.');
        showApiModal();
      } else if (result.error === 'API_KEY_MISSING') {
        showApiModal();
      } else {
        showAlert('error', `API 요청 실패: ${result.details || result.error}`);
      }
      return;
    }

    addMessage('assistant', result.response);

    // TTS: Read companion's response aloud if enabled
    speak(result.response);

    // Track detected structures, if any
    const detected = detectTargetStructures(text, unitContext.targetGrammar || []);
    detected.forEach((s) => STATE.session.structureHits.add(s));

    // Mark unit completed once user responds 3 times in this unit
    if (STATE.session.exchangeCount >= 3) {
      const progress = getProgressData();
      progress.completedUnits[STATE.unitId] = true;
      saveProgressData(progress);

      // Update UI to show completion
      updateUnitSelector();
      updateLessonSelector();
    }

    updateFluencyIndicator();

  } catch (e) {
    console.error(e);
    showAlert('error', '질문 처리 중 오류가 발생했습니다.');
  } finally {
    STATE.isProcessing = false;
    showTypingIndicator(false);
    if (getInputMode() === 'voice') {
      setMicState('idle');
    } else {
      // Re-enable text send button
      elements.textSendBtn.disabled = false;
    }
  }
}

// Add API key modal functions
function showApiModal() {
  elements.apiModal.classList.remove('modal-overlay--hidden');
}

function hideApiModal() {
  elements.apiModal.classList.add('modal-overlay--hidden');
}

function applyApiKey() {
  const key = elements.apiInput.value.trim();
  if (!key) {
    showAlert('warning', 'API 키를 입력해주세요.');
    return;
  }

  const saved = setApiKey(key);
  if (saved) {
    hideApiModal();
    showAlert('success', 'API 키 저장 완료');
  } else {
    showAlert('error', 'API 키 저장 실패');
  }
}

//#endregion

//#region Initialization
function initApp() {
  conversationManager = new ConversationManager();
  STATE.session.sessionStart = Date.now();

  // Load saved navigation position
  loadSavedNavigationPosition();

  // Initialize TTS
  initVoice();
  updateTtsButton();

  // Re-initialize voices if they're loaded later
  window.speechSynthesis.addEventListener('voiceschanged', initVoice);

  // Make debug functions globally available
  window.toggleDebugPanel = toggleDebugPanel;

  // Debug keyboard shortcut (Ctrl+Shift+D)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      toggleDebugPanel();
  }
  });

  // Initial debug log
  addDebugEntry('init', 'Speech API Debug initialisé (Ctrl+Shift+D pour afficher/masquer)');

  // Initialize navigation selectors
  generateUnitSelector();
  generateLessonSelector();

  // Initialize input mode
  updateInputMode();

  // Register DOM events
  elements.micButton.addEventListener('click', toggleListening);
  elements.nextQuestionButton.addEventListener('click', () => nextQuestion());
  elements.ttsToggle.addEventListener('click', () => setTtsEnabled(!isTtsEnabled()));

  // Input mode events
  elements.inputModeBtns.forEach(btn => {
    btn.addEventListener('click', () => setInputMode(btn.dataset.mode));
  });

  elements.textSendBtn.addEventListener('click', sendTextInput);

  elements.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextInput();
    }
  });

  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => updateMode(tab.dataset.mode));
  });

  elements.apiSaveButton.addEventListener('click', applyApiKey);
  elements.apiCancelButton.addEventListener('click', () => {
    if (!getApiKey()) {
      showAlert('error', 'API 키가 필요합니다. 앱을 재실행 후 입력해 주세요.');
    }
    hideApiModal();
  });

  initSpeechRecognition();

  const apiKey = getApiKey();
  if (!apiKey) {
    showApiModal();
  }

  // Initialize UI with current state
  updateHeader();
  updateNav();
  updateProgressBar();
  setMicState('idle');
  updateFluencyIndicator();

  // Start with first question
  nextQuestion();

  window.addEventListener('beforeunload', () => {
    const score = STATE.session.totalUserResponses === 0 ? 0 : Math.round(STATE.session.totalUserWords / STATE.session.totalUserResponses);
    recordFluencySession(score, STATE.session.totalUserWords, STATE.session.exchangeCount);
  });
}

initApp();

//#endregion
  
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  // iOS requires a small delay before speaking
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const delay = isIOS ? 100 : 0;

  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, delay);
}

function unlockAudioContext() {
  if (audioContextUnlocked || !window.speechSynthesis) return;
  
  // Play a silent utterance to unlock audio context on mobile
  const silentUtterance = new SpeechSynthesisUtterance('');
  silentUtterance.volume = 0;
  silentUtterance.onend = () => {
    audioContextUnlocked = true;
  };
  
  window.speechSynthesis.speak(silentUtterance);
}

function updateTtsButton() {
  if (!elements.ttsToggle) return;
  
  if (isTtsEnabled()) {
    elements.ttsToggle.classList.add('tts-toggle--active');
    elements.ttsToggle.setAttribute('title', '음성 합성 켜짐');
  } else {
    elements.ttsToggle.classList.remove('tts-toggle--active');
    elements.ttsToggle.setAttribute('title', '음성 합성 꺼짐');
  }
}

//#endregion

//#region Input Mode Management
function getInputMode() {
  return localStorage.getItem(STORAGE_KEYS.inputMode) || 'voice';
}

function setInputMode(mode) {
  localStorage.setItem(STORAGE_KEYS.inputMode, mode);
  updateInputMode();
}

function updateInputMode() {
  const currentMode = getInputMode();
  
  // Update button states
  elements.inputModeBtns.forEach(btn => {
    if (btn.dataset.mode === currentMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update input areas
  if (currentMode === 'voice') {
    elements.inputAreaVoice.classList.add('active');
    elements.inputAreaText.classList.remove('active');
    // Reset mic state when switching to voice mode
    if (!STATE.isProcessing) {
      setMicState('idle');
    }
  } else {
    elements.inputAreaVoice.classList.remove('active');
    elements.inputAreaText.classList.add('active');
    // Stop any ongoing voice recognition when switching to text mode
    if (STATE.isListening) {
      stopListening();
    }
  }
}

function sendTextInput() {
  const text = elements.textInput.value.trim();
  if (!text || STATE.isProcessing) return;
  
  // Disable send button during processing
  elements.textSendBtn.disabled = true;
  
  // Send to API (same logic as voice input)
  processUserInput(text);
  
  // Clear input
  elements.textInput.value = '';
  elements.textInput.focus();
  
  // Re-enable send button after processing starts
  setTimeout(() => {
    elements.textSendBtn.disabled = false;
  }, 100);
}

//#endregion

//#region UI helpers
function showAlert(type, text) {
  const html = `
    <div class="alert alert--${type}">
      ${text}
    </div>
  `;
  elements.alertArea.innerHTML = html;
  setTimeout(() => {
    elements.alertArea.innerHTML = '';
  }, 4200);
}

function updateHeader() {
  const unit = getUnit(STATE.unitId);
  elements.headerTitle.textContent = unit ? unit.title : 'KoCo';
  elements.headerUnit.textContent = unit ? unit.subtitle : '';
  elements.headerMode.textContent = `${MODE_INFO[STATE.mode].label} · ${unit?.snu_level ?? ''}`;
}

function addMessage(role, text) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', `message--${role}`);

  const bubble = document.createElement('div');
  bubble.classList.add('message__bubble');
  bubble.textContent = text;

  const meta = document.createElement('div');
  meta.classList.add('message__meta');
  meta.textContent = role === 'user' ? '나:' : '코코:';

  bubble.appendChild(meta);
  wrapper.appendChild(bubble);
  elements.conversation.appendChild(wrapper);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function showTypingIndicator(show) {
  elements.typingIndicator.style.display = show ? 'flex' : 'none';
  if (show) elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function setMicState(state) {
  elements.micButton.classList.remove('mic-button--listening', 'mic-button--processing');
  elements.micButton.disabled = false;
  if (state === 'listening') {
    elements.micButton.classList.add('mic-button--listening');
    elements.micStatus.textContent = '듣는 중...';
  } else if (state === 'processing') {
    elements.micButton.classList.add('mic-button--processing');
    elements.micStatus.textContent = '처리 중...';
  } else {
    elements.micStatus.textContent = '마이크 시작';
  }
}

function updateNav() {
  elements.navTabs.forEach(tab => {
    if (tab.dataset.mode === STATE.mode) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

function updateFluencyIndicator() {
  const totalWords = STATE.session.totalUserWords;
  const exchanges = STATE.session.totalUserResponses;
  const avg = exchanges === 0 ? 0 : Math.round(totalWords / exchanges);

  let badgeClass = 'fluency-badge--low';
  let label = '유창성: 짧음';
  let width = 25;

  if (avg > 15) {
    badgeClass = 'fluency-badge--high';
    label = '유창성: 길음';
    width = 90;
  } else if (avg > 7) {
    badgeClass = 'fluency-badge--medium';
    label = '유창성: 중간';
    width = 60;
  }

  elements.fluencyBadge.className = `fluency-badge ${badgeClass}`;
  elements.fluencyBadge.textContent = `${label} (${avg} 단어)`;
  elements.fluencyBarFill.style.width = `${width}%`;
}

function setQuestion(prompt) {
  addMessage('assistant', prompt);
}

function nextQuestion() {
  const unit = getUnit(STATE.unitId);
  if (!unit) return;

  const questions = unit.questions[STATE.mode];
  if (!questions || questions.length === 0) return;

  const used = STATE.usedQuestions[STATE.mode];
  if (used.size === questions.length) {
    used.clear();
  }

  let candidate;
  do {
    candidate = questions[Math.floor(Math.random() * questions.length)];
  } while (used.has(candidate) && used.size < questions.length);

  used.add(candidate);
  setQuestion(candidate);
}

function updateMode(newMode) {
  if (!MODE_INFO[newMode]) return;

  STATE.mode = newMode;
  STATE.usedQuestions[newMode] = STATE.usedQuestions[newMode] || new Set();
  updateHeader();
  updateNav();
  nextQuestion();
}

//#endregion

//#region Speech recognition setup
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showAlert('error', '이 브라우저는 Web Speech API를 지원하지 않습니다. Chrome을 사용하세요.');
    elements.micButton.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    addDebugEntry('onstart', 'micro démarré');
    STATE.isListening = true;
    hasProcessedFinalResult = false; // Reset for new recognition session
    lastInterimText = ''; // Reset interim text
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }
    setMicState('listening');
    elements.transcriptionIndicator.textContent = '음성 인식 중...';
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();
      if (result.isFinal) {
        final += transcript + ' ';
      } else {
        interim += transcript + ' ';
      }
    }

    // Log result details
    const resultText = final || interim;
    const isFinal = final ? 'true' : 'false';
    addDebugEntry('onresult', `isFinal: ${isFinal} — texte: "${resultText}"`);

    elements.transcription.textContent = final || interim;
    elements.transcription.classList.toggle('transcription--interim', !!interim && !final);

    // Store last interim text for fallback
    if (interim) {
      lastInterimText = interim.trim();
    }

    // Clear existing timeout and set new one for silence detection
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
    }
    silenceTimeout = setTimeout(() => {
      if (lastInterimText && !hasProcessedFinalResult) {
        // Samsung/Android fallback: send last interim text after 1500ms silence
        addDebugEntry('timeout', `envoi automatique après 1500ms: "${lastInterimText}"`);
        hasProcessedFinalResult = true;
        processUserInput(lastInterimText);
        elements.transcription.textContent = '';
        lastInterimText = '';
        
        // Restart recognition after processing
        setTimeout(() => {
          if (!STATE.isProcessing) {
            startListening();
          }
        }, 100);
      }
    }, 1500);

    // Only process final results, and only once per recognition session
    if (final && !hasProcessedFinalResult) {
      hasProcessedFinalResult = true;
      clearTimeout(silenceTimeout); // Clear the fallback timeout
      processUserInput(final.trim());
      elements.transcription.textContent = '';
      lastInterimText = '';
      
      // Restart recognition after processing
      setTimeout(() => {
        if (!STATE.isProcessing) {
          startListening();
        }
      }, 100);
    }
  };

  recognition.onerror = (event) => {
    addDebugEntry('onerror', `erreur: ${event.error}`);
    console.error('Speech recognition error', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showAlert('error', '마이크 접근이 거부되었습니다. 브라우저 설정을 확인하세요.');
      stopListening();
      setMicState('idle');
      return;
    }

    showAlert('warning', `음성 인식 오류: ${event.error}`);
  };

  recognition.onend = () => {
    addDebugEntry('onend', 'micro arrêté');
    STATE.isListening = false;
    
    // Clear any pending silence timeout
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }
    
    // Samsung/Android fallback: if we have interim text that wasn't processed, send it
    if (lastInterimText && !hasProcessedFinalResult) {
      addDebugEntry('onend', `envoi texte restant: "${lastInterimText}"`);
      hasProcessedFinalResult = true;
      processUserInput(lastInterimText);
      elements.transcription.textContent = '';
      lastInterimText = '';
    }
    
    if (STATE.isProcessing) {
      // Keep in processing state until API response.
      return;
    }
    setMicState('idle');
    elements.transcriptionIndicator.textContent = '마이크 정지';
  };
}

function startListening() {
  if (!recognition || STATE.isListening) return;
  try {
    recognition.start();
  } catch (error) {
    console.warn('Unable to start recognition', error);
  }
}

function stopListening() {
  if (!recognition || !STATE.isListening) return;
  
  // Clear any pending silence timeout
  if (silenceTimeout) {
    clearTimeout(silenceTimeout);
    silenceTimeout = null;
  }
  
  recognition.stop();
}

function toggleListening() {
  if (STATE.isListening) {
    stopListening();
  } else {
    // Unlock audio context on first mic click (for mobile TTS)
    unlockAudioContext();
    startListening();
  }
}

//#endregion

//#region API interaction + conversation flow
async function processUserInput(text) {
  if (!text) return;

  // Add user message to the UI
  addMessage('user', text);

  // Fluency metrics update
  const fluency = analyzeFluency(text);
  STATE.session.totalUserWords += fluency.wordCount;
  STATE.session.totalUserResponses += 1;
  STATE.session.exchangeCount += 1;

  const unitContext = getUnit(STATE.unitId);
  const context = getSessionContext(STATE.unitId, parseInt(unitContext?.snu_level?.[3] || '3', 10) || 3);
  const systemPrompt = generateSystemPrompt(context, STATE.mode);

  STATE.isProcessing = true;
  if (getInputMode() === 'voice') {
    setMicState('processing');
  }
  showTypingIndicator(true);

  try {
    const result = await callAnthropicAPI(text, conversationManager, systemPrompt);

    if (!result.success) {
      if (result.error === 'INVALID_API_KEY') {
        showAlert('error', 'API 키가 잘못되었습니다. 다시 입력해주세요.');
        showApiModal();
      } else if (result.error === 'API_KEY_MISSING') {
        showApiModal();
      } else {
        showAlert('error', `API 요청 실패: ${result.details || result.error}`);
      }
      return;
    }

    addMessage('assistant', result.response);

    // TTS: Read companion's response aloud if enabled
    speak(result.response);

    // Track detected structures, if any
    const detected = detectTargetStructures(text, unitContext.targetGrammar || []);
    detected.forEach((s) => STATE.session.structureHits.add(s));

    // Mark unit completed once user responds 3 times in this unit
    if (STATE.session.exchangeCount >= 3) {
      const progress = getProgressData();
      progress.completedUnits[STATE.unitId] = true;
      saveProgressData(progress);
    }

    updateFluencyIndicator();

  } catch (e) {
    console.error(e);
    showAlert('error', '질문 처리 중 오류가 발생했습니다.');
  } finally {
    STATE.isProcessing = false;
    showTypingIndicator(false);
    if (getInputMode() === 'voice') {
      setMicState('idle');
    } else {
      // Re-enable text send button
      elements.textSendBtn.disabled = false;
    }
  }
}

// Add API key modal functions
function showApiModal() {
  elements.apiModal.classList.remove('modal-overlay--hidden');
}

function hideApiModal() {
  elements.apiModal.classList.add('modal-overlay--hidden');
}

function applyApiKey() {
  const key = elements.apiInput.value.trim();
  if (!key) {
    showAlert('warning', 'API 키를 입력해주세요.');
    return;
  }

  const saved = setApiKey(key);
  if (saved) {
    hideApiModal();
    showAlert('success', 'API 키 저장 완료');
  } else {
    showAlert('error', 'API 키 저장 실패');
  }
}

//#endregion

//#region Initialization
function initApp() {
  conversationManager = new ConversationManager();
  STATE.session.sessionStart = Date.now();

  // Initialize TTS
  initVoice();
  updateTtsButton();

  // Re-initialize voices if they're loaded later
  window.speechSynthesis.addEventListener('voiceschanged', initVoice);

  // Make debug functions globally available
  window.toggleDebugPanel = toggleDebugPanel;

  // Debug keyboard shortcut (Ctrl+Shift+D)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      toggleDebugPanel();
    }
  });

  // Initial debug log
  addDebugEntry('init', 'Speech API Debug initialisé (Ctrl+Shift+D pour afficher/masquer)');

  // Initialize input mode
  updateInputMode();

  // Register DOM events
  elements.micButton.addEventListener('click', toggleListening);
  elements.nextQuestionButton.addEventListener('click', () => nextQuestion());
  elements.ttsToggle.addEventListener('click', () => setTtsEnabled(!isTtsEnabled()));
  
  // Input mode events
  elements.inputModeBtns.forEach(btn => {
    btn.addEventListener('click', () => setInputMode(btn.dataset.mode));
  });
  
  elements.textSendBtn.addEventListener('click', sendTextInput);
  
  elements.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextInput();
    }
  });

  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => updateMode(tab.dataset.mode));
  });

  elements.apiSaveButton.addEventListener('click', applyApiKey);
  elements.apiCancelButton.addEventListener('click', () => {
    if (!getApiKey()) {
      showAlert('error', 'API 키가 필요합니다. 앱을 재실행 후 입력해 주세요.');
    }
    hideApiModal();
  });

  initSpeechRecognition();

  const apiKey = getApiKey();
  if (!apiKey) {
    showApiModal();
  }

  updateMode(STATE.mode);
  setMicState('idle');
  updateFluencyIndicator();

  window.addEventListener('beforeunload', () => {
    const score = STATE.session.totalUserResponses === 0 ? 0 : Math.round(STATE.session.totalUserWords / STATE.session.totalUserResponses);
    recordFluencySession(score, STATE.session.totalUserWords, STATE.session.exchangeCount);
  });
}

initApp();

//#endregion
