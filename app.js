/**
 * KoCo — Korean Conversation Companion
 * app.js — Application logic, modes, speech recognition, Supabase auth & data
 */

// Supabase client and functions available globally from CDN

//#region App state
const STATE = {
  mode: 'freeChat',
  unitId: 'unit_1_1',
  lessonId: null, // For future multi-lesson units
  isListening: false,
  isProcessing: false,
  debateFormat: 'proCon',
  usedQuestions: {
    freeChat: new Set(),
    debate: new Set(),
    speedDrill: new Set()
  },
  session: {
    sessionStart: null,
    exchangeCount: 0,
    totalUserWords: 0,
    totalUserResponses: 0,
    structureHits: new Set(),
    supabaseSessionId: null // Track current Supabase session
  },
  user: null // Current authenticated user
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
  speedDrill: { icon: '⚡', label: '드릴' }
};

let conversationManager;
let recognition;
let selectedVoice = null;
let hasProcessedFinalResult = false; // Track if we've already processed a final result in current session
let audioContextUnlocked = false; // Track if audio context has been unlocked for TTS
let lastInterimText = ''; // Store last interim text for Samsung/Android fallback
let silenceTimeout = null; // Timeout for silence detection

//#endregion

//#region Authentication

/**
 * Initialize authentication and check current session
 */
async function initAuth() {
  try {
    // Check for existing session
    const { data: { session }, error } = await window.supabase.auth.getSession();

    if (session && session.user) {
      STATE.user = session.user;
      showMainApp();
      addDebugEntry('auth', `Utilisateur connecté: ${session.user.email}`);
    } else {
      showLoginScreen();
      addDebugEntry('auth', 'Aucune session active, affichage écran de connexion');
    }

    // Listen for auth changes
    window.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        STATE.user = session.user;
        showMainApp();
        addDebugEntry('auth', `Connexion réussie: ${session.user.email}`);
      } else if (event === 'SIGNED_OUT') {
        STATE.user = null;
        showLoginScreen();
        addDebugEntry('auth', 'Déconnexion');
      }
    });

  } catch (error) {
    console.error('Erreur d\'initialisation auth:', error);
    showLoginScreen();
  }
}

/**
 * Show login screen and hide main app
 */
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('logoutBtn').style.display = 'none';
}

/**
 * Show main app and hide login screen
 */
function showMainApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  document.getElementById('logoutBtn').style.display = 'flex';
}

/**
 * Handle Google login button click
 */
async function handleGoogleLogin() {
  console.log('Google login clicked'); // Debug log

  const messageEl = document.getElementById('loginMessage');
  const button = document.getElementById('googleLoginButton');

  // Disable button and show loading
  button.disabled = true;
  button.innerHTML = `
    <svg class="login-google-icon" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
    연결 중...
  `;
  messageEl.textContent = '';

  try {
    const { error } = await window.auth.signInWithGoogle();

    if (error) {
      throw error;
    }

    // OAuth will redirect, so we don't need to do anything else here
    showLoginMessage('Google 로그인 페이지로 이동합니다...', 'success');

  } catch (error) {
    console.error('Erreur de connexion Google:', error);
    showLoginMessage('Google 로그인에 실패했습니다. 다시 시도해주세요.', 'error');

    // Reset button
    button.disabled = false;
    button.innerHTML = `
      <svg class="login-google-icon" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Google로 로그인
    `;
  }
}

/**
 * Show login message
 */
function showLoginMessage(message, type) {
  const messageEl = document.getElementById('loginMessage');
  messageEl.textContent = message;
  messageEl.className = `login-message ${type}`;
}

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    await window.auth.signOut();
  } catch (error) {
    console.error('Erreur de déconnexion:', error);
  }
}

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
  navDropdownToggle: document.getElementById('navDropdownToggle'),
  navDropdownLabel: document.getElementById('navDropdownLabel'),
  navDropdownMenu: document.getElementById('navDropdownMenu'),

  // Input — WhatsApp-style unified bar
  inputBarMicBtn: document.getElementById('inputBarMicBtn'),
  inputBarText: document.getElementById('inputBarText'),
  inputBarActionBtn: document.getElementById('inputBarActionBtn'),
  transcriptionInline: document.getElementById('transcriptionInline'),

  // Conversation
  conversation: document.querySelector('.conversation'),
  transcription: document.querySelector('.transcription'),
  transcriptionIndicator: document.querySelector('.transcription__indicator'),

  // Navigation & UI
  navTabs: Array.from(document.querySelectorAll('.nav-tab')),
  ttsToggle: document.querySelector('.tts-toggle'),
  debateOptimizeBtn: document.getElementById('debateOptimizeBtn'),
  debateOptimizeModal: document.getElementById('debateOptimizeModal'),
  debateOptimizeStartBtn: document.getElementById('debateOptimizeStartBtn'),
  debateOptimizeCancelBtn: document.getElementById('debateOptimizeCancelBtn'),
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
 * Generate navigation dropdown with all chapters and lessons
 */
function generateNavDropdown() {
  elements.navDropdownMenu.innerHTML = '';

  // Iterate through all chapters
  for (const chapterNum in CHAPTERS) {
    const chapter = CHAPTERS[chapterNum];

    // Create chapter group
    const chapterSection = document.createElement('div');
    chapterSection.className = 'nav-dropdown-chapter';

    // Chapter title (without "단원")
    const chapterTitle = document.createElement('div');
    chapterTitle.className = 'nav-dropdown-chapter-title';
    chapterTitle.textContent = `${chapter.major} ${chapter.title}`;
    chapterSection.appendChild(chapterTitle);

    // Add lessons for this chapter
    for (const lessonNum in chapter.lessons) {
      const lesson = chapter.lessons[lessonNum];
      const unitId = lesson.id;

      const lessonDiv = document.createElement('div');
      lessonDiv.className = 'nav-dropdown-lesson';

      const lessonBtn = document.createElement('button');
      const isAvailable = Boolean(UNITS[unitId]);
      lessonBtn.className = `nav-dropdown-lesson-btn${isAvailable ? '' : ' nav-dropdown-lesson-btn--disabled'}`;
      lessonBtn.textContent = `${chapter.major}-${lessonNum} ${lesson.title}`;
      lessonBtn.dataset.unitId = unitId;
      lessonBtn.disabled = !isAvailable;
      lessonBtn.title = isAvailable ? `${chapter.major}-${lessonNum} ${lesson.title}` : '이 레슨은 아직 준비되지 않았습니다.';

      // Mark as selected if current unit
      if (unitId === STATE.unitId && isAvailable) {
        lessonBtn.setAttribute('data-selected', 'true');
      }

      if (isAvailable) {
        lessonBtn.addEventListener('click', () => {
          selectUnit(unitId);
          closeNavDropdown();
        });
      }

      lessonDiv.appendChild(lessonBtn);
      chapterSection.appendChild(lessonDiv);
    }

    elements.navDropdownMenu.appendChild(chapterSection);
  }

  // Update label to show current selection
  updateNavDropdownLabel();
}

/**
 * Update the dropdown label to show current unit
 */
function updateNavDropdownLabel() {
  // Find current chapter and lesson
  let found = false;
  for (const chapterNum in CHAPTERS) {
    const chapter = CHAPTERS[chapterNum];
    for (const lessonNum in chapter.lessons) {
      const lesson = chapter.lessons[lessonNum];
      if (lesson.id === STATE.unitId) {
        elements.navDropdownLabel.textContent = `${chapter.major} ${chapter.title}`;
        found = true;
        break;
      }
    }
    if (found) break;
  }
}

/**
 * Toggle nav dropdown menu visibility
 */
function toggleNavDropdown() {
  const isExpanded = elements.navDropdownToggle.getAttribute('aria-expanded') === 'true';
  if (isExpanded) {
    closeNavDropdown();
  } else {
    openNavDropdown();
  }
}

/**
 * Open nav dropdown menu
 */
function openNavDropdown() {
  elements.navDropdownToggle.setAttribute('aria-expanded', 'true');
  elements.navDropdownMenu.style.display = 'block';
}

/**
 * Close nav dropdown menu
 */
function closeNavDropdown() {
  elements.navDropdownToggle.setAttribute('aria-expanded', 'false');
  elements.navDropdownMenu.style.display = 'none';
}

/**
 * Select a unit and update UI
 */
function selectUnit(unitId) {
  if (!UNITS[unitId]) return;

  // Update state
  STATE.unitId = unitId;
  STATE.lessonId = unitId;

  // Save to localStorage
  localStorage.setItem(STORAGE_KEYS.selectedUnit, unitId);
  localStorage.setItem(STORAGE_KEYS.selectedLesson, unitId);

  // Update UI
  generateNavDropdown();
  updateHeader();
  updateProgressBar();

  // Reset conversation and questions for new unit
  resetConversationForNewUnit();

  addDebugEntry('navigation', `Unité sélectionnée: ${unitId}`);
}

/**
 * Update header with current lesson context
 */
function updateHeader() {
  const unit = UNITS[STATE.unitId];
  if (!unit) return;

  // Keep app branding but show the current unit group and lesson info
  const [major, minor] = unit.id.replace('unit_', '').split('_');
  elements.headerBranding.textContent = `${major}단원 ${unit.theme || ''}`;

  // Title should include Korean and English label (matching screenshot style)
  elements.headerLessonTitle.textContent = `${unit.title} ${unit.subtitle ? `· ${unit.subtitle}` : ''}`;
  elements.headerLessonTheme.textContent = `학습 단원: ${major}-${minor}`;
  elements.headerModeBadge.textContent = MODE_INFO[STATE.mode].icon;

  addDebugEntry('header', `Mis à jour: ${elements.headerBranding.textContent} | ${elements.headerLessonTitle.textContent}`);
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

//#region Input Mode Management — WhatsApp-Style Unified Bar
/**
 * Update input bar state and action button icon based on text content
 */
function updateInputBarState() {
  if (STATE.isListening) {
    // Show keyboard button when listening
    elements.inputBarActionBtn.textContent = '⌨️';
    elements.inputBarActionBtn.style.color = '#4a90e2';
  } else {
    // Show send button when not listening
    elements.inputBarActionBtn.textContent = '➤';
    elements.inputBarActionBtn.style.color = '#4a90e2';
  }
}

/**
 * Send text input from the unified input bar
 */
function sendTextInput() {
  const text = elements.inputBarText.value.trim();
  if (!text || STATE.isProcessing) return;

  // Disable action button during processing
  elements.inputBarActionBtn.disabled = true;

  // Send to API
  processUserInput(text);

  // Clear input
  elements.inputBarText.value = '';
  updateInputBarState();
  elements.inputBarText.focus();

  // Re-enable action button after processing starts
  setTimeout(() => {
    elements.inputBarActionBtn.disabled = false;
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
  // Update visual feedback for mic button and action button
  elements.inputBarMicBtn.classList.remove('listening');
  elements.inputBarMicBtn.disabled = false;
  
  if (state === 'listening') {
    elements.inputBarMicBtn.classList.add('listening');
    elements.inputBarMicBtn.style.color = '#ff4444';
    if (elements.transcriptionInline) {
      elements.transcriptionInline.classList.add('active');
    }
  } else if (state === 'processing') {
    elements.inputBarMicBtn.style.opacity = '0.6';
  } else {
    elements.inputBarMicBtn.style.color = '#4a90e2';
    elements.inputBarMicBtn.style.opacity = '1';
    if (elements.transcriptionInline) {
      elements.transcriptionInline.classList.remove('active');
    }
  }
  
  // Update action button state
  updateInputBarState();
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
  
  // FIX 1 : Vider la conversation au changement de mode
  elements.conversation.innerHTML = '';
  
  updateHeader();
  updateNav();
  updateDebateOptimizeButtonVisibility();
  nextQuestion();
}

function updateDebateOptimizeButtonVisibility() {
  if (!elements.debateOptimizeBtn) return;
  if (STATE.mode === 'debate') {
    elements.debateOptimizeBtn.classList.remove('header__optimize-btn--hidden');
  } else {
    elements.debateOptimizeBtn.classList.add('header__optimize-btn--hidden');
    closeDebateOptimize();
  }
}

function openDebateOptimize() {
  if (!elements.debateOptimizeModal) return;
  elements.debateOptimizeModal.classList.remove('modal-overlay--hidden');
  elements.debateOptimizeModal.setAttribute('aria-hidden', 'false');
}

function closeDebateOptimize() {
  if (!elements.debateOptimizeModal) return;
  elements.debateOptimizeModal.classList.add('modal-overlay--hidden');
  elements.debateOptimizeModal.setAttribute('aria-hidden', 'true');
}

function applyDebateOptimizeSettings() {
  const selectedOption = document.querySelector('input[name="debateFormat"]:checked');
  const chosenFormat = selectedOption ? selectedOption.value : 'proCon';
  STATE.debateFormat = chosenFormat;
  
  // Clean slate for new debate format
  elements.conversation.innerHTML = '';
  if (conversationManager && typeof conversationManager.clear === 'function') {
    conversationManager.clear();
  }

  // Ensure debate mode is active
  STATE.mode = 'debate';
  updateHeader();
  updateNav();
  updateDebateOptimizeButtonVisibility();
  closeDebateOptimize();
  nextQuestion();
  showAlert('success', '토론 형식이 적용되었습니다. 새로운 토론을 시작합니다.');
}


//#endregion

//#region Speech recognition setup
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showAlert('error', '이 브라우저는 Web Speech API를 지원하지 않습니다. Chrome을 사용하세요.');
    elements.inputBarMicBtn.disabled = true;
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

/**
 * Handle action button click — send text or toggle voice
 */
function handleActionButtonClick() {
  if (STATE.isListening) {
    // Switch to keyboard
    switchToKeyboard();
  } else {
    // Send text
    sendTextInput();
  }
}

/**
 * Switch to text input mode via keyboard button
 */
function switchToKeyboard() {
  if (STATE.isListening) {
    stopListening();
  }
  // Focus on the text input
  elements.inputBarText.focus();
}

//#endregion

//#region API key modal functions
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


//#region API interaction + conversation flow
async function processUserInput(text) {
  if (!text) return;

  // Create or update Supabase session
  if (!STATE.session.supabaseSessionId) {
    try {
      const modeMap = {
        freeChat: '자유대화',
        debate: '토론',
        speedDrill: '드릴'
      };

      const sessionData = {
        user_id: STATE.user.id,
        lesson_id: STATE.unitId, // Using unitId as lesson_id for now
        mode: modeMap[STATE.mode] || '자유대화',
        created_at: new Date().toISOString()
      };

      const { data: session, error } = await window.db.createSession(sessionData);
      if (session) {
        STATE.session.supabaseSessionId = session.id;
        addDebugEntry('session', `Session Supabase créée: ${session.id}`);
      } else {
        console.error('Erreur création session:', error);
      }
    } catch (error) {
      console.error('Erreur création session Supabase:', error);
    }
  } else {
    // Update session duration
    try {
      const duration = Math.floor((Date.now() - STATE.session.sessionStart) / 1000);
      await window.db.updateSession(STATE.session.supabaseSessionId, {
        duration_seconds: duration
      });
    } catch (error) {
      console.error('Erreur mise à jour durée session:', error);
    }
  }

  // Add user message to the UI
  addMessage('user', text);

  // Fluency metrics update
  const fluency = analyzeFluency(text);
  STATE.session.totalUserWords += fluency.wordCount;
  STATE.session.totalUserResponses += 1;
  STATE.session.exchangeCount += 1;

  const unitContext = getUnit(STATE.unitId);
  const context = getSessionContext(STATE.unitId, parseInt(unitContext?.snu_level?.[3] || '3', 10) || 3);
  const systemPrompt = generateSystemPrompt(context, STATE.mode, STATE.debateFormat);

  STATE.isProcessing = true;
  // Show processing state when listening
  if (STATE.isListening) {
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
        showAlert('error', 'API 키가 필요합니다. 설정에서 API 키를 입력해주세요.');
        showApiModal();
      } else if (result.error === 'NETWORK_ERROR' && result.details === 'Failed to fetch') {
        showAlert('error', '서버에 연결할 수 없습니다. 터미널에서 "npm start"를 실행하여 프록시 서버를 시작하세요.');
      } else {
        showAlert('error', `API 요청 실패: ${result.details || result.error}`);
      }
      return;
    }

    // Parse response to separate conversation from correction
    const { conversationResponse, correctionBlock } = parseApiResponse(result.response);

    // Add conversation response
    addMessage('assistant', conversationResponse);

    // Add correction block if present
    if (correctionBlock) {
      addCorrectionBlock(correctionBlock, text);
    }

    // TTS: Read companion's response aloud if enabled (only the conversation part)
    speak(conversationResponse);

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
    if (STATE.isListening) {
      setMicState('idle');
    } else {
      // Re-enable action button after processing
      elements.inputBarActionBtn.disabled = false;
    }
  }
}

//#endregion

//#region Response Parsing & Correction Display

/**
 * Parse API response to separate conversation from correction
 * @param {string} response - Full API response
 * @returns {object} { conversationResponse, correctionBlock }
 */
function parseApiResponse(response) {
  const separator = '---\nCORRECTION:';

  if (response.includes(separator)) {
    const parts = response.split(separator);
    return {
      conversationResponse: parts[0].trim(),
      correctionBlock: parts[1].trim()
    };
  }

  // Fallback: if no separator found, treat whole response as conversation
  return {
    conversationResponse: response.trim(),
    correctionBlock: null
  };
}

/**
 * Add a correction block to the conversation
 * @param {string} correctionText - The correction content
 * @param {string} originalUserText - The user's original message
 */
function addCorrectionBlock(correctionText, originalUserText) {
  // Create correction message element
  const correctionDiv = document.createElement('div');
  correctionDiv.className = 'message message--correction';

  // Format the correction block
  const formattedCorrection = formatCorrectionBlock(correctionText, originalUserText);

  correctionDiv.innerHTML = `
    <div class="correction-block">
      ${formattedCorrection}
    </div>
  `;

  // Add to conversation
  elements.conversation.appendChild(correctionDiv);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;

  addDebugEntry('correction', `Correction affichée: ${correctionText.substring(0, 50)}...`);
}

/**
 * Format correction text into visual block
 * @param {string} correctionText - Raw correction text
 * @param {string} originalUserText - User's original message
 * @returns {string} HTML formatted correction
 */
function formatCorrectionBlock(correctionText, originalUserText) {
  // If it's a positive message (no correction needed)
  if (correctionText.includes('자연스러워요') || correctionText.includes('잘 하셨어요')) {
    return `
      <div class="correction-positive">
        ${correctionText}
      </div>
    `;
  }

  // Parse structured correction
  const lines = correctionText.split('\n').filter(line => line.trim());

  return `
    <div class="correction-structured">
      <div class="correction-line">💬 Ta phrase : "${originalUserText}"</div>
      ${lines.map(line => {
        if (line.startsWith('✅')) {
          return `<div class="correction-line correction-natural">${line}</div>`;
        } else if (line.startsWith('🔧')) {
          return `<div class="correction-line correction-explanation">${line}</div>`;
        } else {
          return `<div class="correction-line">${line}</div>`;
        }
      }).join('')}
    </div>
  `;
}

//#endregion

//#region Initialization
async function initApp() {
  // Initialize authentication first
  await initAuth();

  // Only initialize the rest of the app if user is authenticated
  if (!STATE.user) {
    return;
  }

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

  // Initialize navigation dropdown
  generateNavDropdown();

  // Initialize input bar state
  updateInputBarState();

  // Register DOM events
  elements.navDropdownToggle.addEventListener('click', toggleNavDropdown);

  // Input bar events
  elements.inputBarMicBtn.addEventListener('click', toggleListening);
  elements.inputBarActionBtn.addEventListener('click', handleActionButtonClick);
  elements.inputBarText.addEventListener('input', updateInputBarState);
  elements.inputBarText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleActionButtonClick();
    }
  });

  elements.nextQuestionButton.addEventListener('click', () => nextQuestion());
  elements.ttsToggle.addEventListener('click', () => setTtsEnabled(!isTtsEnabled()));

  if (elements.debateOptimizeBtn) {
    elements.debateOptimizeBtn.addEventListener('click', openDebateOptimize);
  }
  if (elements.debateOptimizeStartBtn) {
    elements.debateOptimizeStartBtn.addEventListener('click', applyDebateOptimizeSettings);
  }
  if (elements.debateOptimizeCancelBtn) {
    elements.debateOptimizeCancelBtn.addEventListener('click', closeDebateOptimize);
  }

  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => updateMode(tab.dataset.mode));
  });

  // Logout button event
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-dropdown-section')) {
      closeNavDropdown();
    }
  });

  initSpeechRecognition();

  // Initialize UI with current state
  updateHeader();
  updateNav();
  updateProgressBar();
  updateMode(STATE.mode);
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

// Initialize login form event listener
const googleBtn = document.getElementById('googleLoginButton');
console.log('Google login button found:', !!googleBtn); // Debug log

if (googleBtn) {
  googleBtn.addEventListener('click', handleGoogleLogin);
  console.log('Google login event listener attached'); // Debug log
} else {
  console.error('Google login button not found!'); // Debug log
}

//#endregion
