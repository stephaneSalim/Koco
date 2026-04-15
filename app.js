/**
 * KoCo — Korean Conversation Companion
 * app.js — Application logic, modes, speech recognition, localStorage
 */

//#region App state
const STATE = {
  mode: 'freeChat',
  unitId: 'unit_1_1',
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
  apiKey: 'koco_anthropic_api_key'
};

const MODE_INFO = {
  freeChat: { icon: '💬', label: '자유 대화' },
  debate: { icon: '⚖️', label: '토론' },
  speaking: { icon: '🗣️', label: '말하기 시험' },
  speedDrill: { icon: '⚡', label: '속도 드릴' }
};

let conversationManager;
let recognition;

const elements = {
  headerTitle: document.querySelector('.header__title'),
  headerUnit: document.querySelector('.header__unit'),
  headerMode: document.querySelector('.header__mode'),
  conversation: document.querySelector('.conversation'),
  transcription: document.querySelector('.transcription'),
  transcriptionIndicator: document.querySelector('.transcription__indicator'),
  micButton: document.querySelector('.mic-button'),
  micStatus: document.querySelector('.mic-status'),
  navTabs: Array.from(document.querySelectorAll('.nav-tab')),
  fluencyBarFill: document.querySelector('.fluency-bar__fill'),
  fluencyBadge: document.querySelector('.fluency-badge'),
  apiModal: document.querySelector('.modal-overlay'),
  apiInput: document.querySelector('.modal__input'),
  apiSaveButton: document.querySelector('.modal__button--primary'),
  apiCancelButton: document.querySelector('.modal__button--secondary'),
  alertArea: document.querySelector('.alert-area'),
  typingIndicator: document.querySelector('.typing-indicator'),
  nextQuestionButton: document.querySelector('.next-question-btn'),
  loginScreen: document.getElementById('loginScreen'),
  appContainer: document.getElementById('app')
};

function showLoginScreen() {
  if (elements.loginScreen) elements.loginScreen.style.display = 'flex';
  if (elements.appContainer) elements.appContainer.style.display = 'none';
}

function showAppScreen() {
  if (elements.loginScreen) elements.loginScreen.style.display = 'none';
  if (elements.appContainer) elements.appContainer.style.display = 'block';
}

async function checkSession() {
  try {
    const { data: { session }, error } = await window.supabaseClient.auth.getSession();
    if (error) {
      console.error('Supabase session error', error);
    }
    if (session?.user) {
      showAppScreen();
    } else {
      showLoginScreen();
    }
  } catch (err) {
    console.error('Session validation failed', err);
    showLoginScreen();
  }
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
    STATE.isListening = true;
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

    elements.transcription.textContent = final || interim;
    elements.transcription.classList.toggle('transcription--interim', !!interim && !final);

    if (final) {
      processUserInput(final.trim());
      elements.transcription.textContent = '';
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showAlert('error', '마이크 접근이 거부되었습니다. 브라우저 설정을 확인하세요.');
      stopListening();
      stateResetMic();
      return;
    }

    showAlert('warning', `음성 인식 오류: ${event.error}`);
  };

  recognition.onend = () => {
    STATE.isListening = false;
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
  recognition.stop();
}

function toggleListening() {
  if (STATE.isListening) {
    stopListening();
  } else {
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
  setMicState('processing');
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
    setMicState('idle');
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

  // Register DOM events
  elements.micButton.addEventListener('click', toggleListening);
  elements.nextQuestionButton.addEventListener('click', () => nextQuestion());

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

checkSession();
initApp();

//#endregion
