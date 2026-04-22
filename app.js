/**
 * KoCo — Korean Conversation Companion
 * app.js — Application logic, modes, speech recognition, localStorage
 */

//#region App state
const STATE = {
  mode: 'freeChat',
  unitId: 'snu_5a_1_1',
  activeUnit: null,
  isListening: false,
  isProcessing: false,
  usedQuestions: {
    freeChat: new Set(),
    debate: new Set()
  },
  session: {
    sessionStart: null,
    exchangeCount: 0,
    totalUserWords: 0,
    totalUserResponses: 0,
    structureHits: new Set()
  },
  gmsSentences: [],
  isSpeaking: false,
  messageCount: 0,
  sessionCorrections: [],
  pageContext: null
};

// Normalize a Supabase snu_units row to a stable unit object used throughout the app
function normalizeSNUUnit(row) {
  return {
    id: row.id,
    title: row.title_ko || row.id,
    subtitle: row.title_en || '',
    theme: row.sous_theme || '',
    snu_level: `${row.level}_${row.unit_number}-${row.lesson_number}`,
    grand_theme_label_fr: row.grand_themes?.label_fr || '',
    sous_theme: row.sous_theme || '',
    level: row.level || '',
    unit_number: row.unit_number,
    lesson_number: row.lesson_number
  };
}

// Map Supabase ID (snu_5a_1_1) → data.js key (unit_1_1) for vocab/questions fallback
function getDataUnitId(snuId) {
  const m = snuId && snuId.match(/snu_\w+_(\d+)_(\d+)/);
  return m ? `unit_${m[1]}_${m[2]}` : null;
}

const STORAGE_KEYS = {
  progress: 'koco_progress',
  fluencySessions: 'koco_fluency_sessions',
  apiKey: 'koco_anthropic_api_key'
};

const MODE_INFO = {
  freeChat: { icon: '💬', label: '자유 대화' },
  debate: { icon: '⚖️', label: '토론' }
};

let conversationManager;
let _mediaRecorder = null;
let _audioChunks = [];
let _isRecording = false;

const elements = {
  headerUnitTitle: document.getElementById('headerUnitTitle'),
  headerUnitSub: document.getElementById('headerUnitSub'),
  unitSelectorBtn: document.getElementById('unitSelectorBtn'),
  unitSelectorModal: document.getElementById('unitSelectorModal'),
  unitSelectorList: document.getElementById('unitSelectorList'),
  conversation: document.querySelector('.conversation'),
  transcription: document.querySelector('.transcription'),
  transcriptionIndicator: document.querySelector('.transcription__indicator'),
  micButton: document.getElementById('inputBarMicBtn'),
  userTextInput: document.getElementById('userTextInput'),
  photoInputBtn: document.getElementById('photoInputBtn'),
  photoFileInput: document.getElementById('photoFileInput'),
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
  ttsToggleButton: document.querySelector('.tts-toggle'),
  endSessionBtn: document.getElementById('endSessionBtn'),
  sessionSummaryModal: document.getElementById('sessionSummaryModal'),
  statsScreen: document.getElementById('statsScreen'),
  transcriptionPanel: document.querySelector('.transcription-panel'),
  fluencyBar: document.querySelector('.fluency-bar'),
  fluencyBadge: document.querySelector('.fluency-badge'),
  micContainer: document.querySelector('.wa-input-bar')
};

let ttsPulseInterval = null;
let ttsEnabled = localStorage.getItem('koco_tts_enabled') !== 'false';

function createTtsToggleButton() {
  const existing = document.getElementById('ttsToggleBtn');
  if (existing) {
    existing.addEventListener('click', toggleTts);
    return existing;
  }
  return null;
}

function updateTtsButton() {
  if (!elements.ttsToggleButton) return;
  elements.ttsToggleButton.textContent = ttsEnabled ? '🔊' : '🔇';
  elements.ttsToggleButton.style.opacity = ttsEnabled ? '1' : '0.65';
}

function toggleTts() {
  ttsEnabled = !ttsEnabled;
  localStorage.setItem('koco_tts_enabled', ttsEnabled);
  if (!ttsEnabled) stopTts();
  updateTtsButton();
}

function startTtsPulse() {
  if (!elements.ttsToggleButton) return;
  stopTtsPulse();
  elements.ttsToggleButton.style.transform = 'scale(1.05)';
  ttsPulseInterval = setInterval(() => {
    elements.ttsToggleButton.style.transform = elements.ttsToggleButton.style.transform === 'scale(1.05)' ? 'scale(1)' : 'scale(1.05)';
  }, 600);
}

function stopTtsPulse() {
  if (!elements.ttsToggleButton) return;
  if (ttsPulseInterval) {
    clearInterval(ttsPulseInterval);
    ttsPulseInterval = null;
  }
  elements.ttsToggleButton.style.transform = '';
}

let _currentTtsAudio = null;

function stopTts() {
  stopTtsPulse();
  if (_currentTtsAudio) {
    _currentTtsAudio.pause();
    _currentTtsAudio = null;
  }
}

function cleanForTTS(text) {
  return text
    .replace(/\[CORRECTION\][\s\S]*?\[\/CORRECTION\]/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .trim();
}

function speakKorean(text) {
  return new Promise(async (resolve) => {
    STATE.isSpeaking = true;
    startTtsPulse();

    const cleaned = cleanForTTS(text);
    if (!cleaned) {
      STATE.isSpeaking = false;
      stopTtsPulse();
      resolve();
      return;
    }

    const done = () => {
      STATE.isSpeaking = false;
      stopTtsPulse();
      setMicState('idle');
      _currentTtsAudio = null;
      resolve();
    };

    try {
      const resp = await fetch(API_CONFIG.TTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleaned })
      });

      if (!resp.ok) throw new Error(`TTS ${resp.status}`);

      const { audio } = await resp.json();
      const binary = atob(audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const audioEl = new Audio(url);
      _currentTtsAudio = audioEl;
      audioEl.onended = () => { URL.revokeObjectURL(url); done(); };
      audioEl.onerror = () => { URL.revokeObjectURL(url); done(); };
      audioEl.play();

    } catch (e) {
      console.warn('ElevenLabs TTS failed:', e.message);
      done();
    }
  });
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
  const unit = STATE.activeUnit;
  if (elements.headerUnitTitle) {
    elements.headerUnitTitle.textContent = unit ? unit.title : '단원 선택';
  }
  if (elements.headerUnitSub) {
    elements.headerUnitSub.textContent = unit
      ? `${unit.subtitle} · ${MODE_INFO[STATE.mode].label}`
      : '';
  }
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

function parseCorrection(fullText) {
  const match = fullText.match(/\[CORRECTION\]([\s\S]*?)\[\/CORRECTION\]/);
  if (!match) return { text: fullText, correction: null };

  const text = fullText.replace(/\[CORRECTION\][\s\S]*?\[\/CORRECTION\]/, '').trim();
  const block = match[1];

  const get = (key) => {
    const m = block.match(new RegExp(`${key}:\\s*(.+)`));
    return m ? m[1].trim() : '';
  };

  return {
    text,
    correction: {
      status: get('STATUS').toLowerCase(),
      original: get('ORIGINAL'),
      fixed: get('FIXED'),
      note: get('NOTE')
    }
  };
}

function addCorrectionBlock(correction) {
  if (!correction) return;

  const el = document.createElement('div');
  el.className = `correction-block correction-block--${correction.status}`;

  if (correction.status === 'correct') {
    el.textContent = '✅ 자연스러워요!';
  } else {
    el.innerHTML =
      `🔧 <strong>${correction.original}</strong> → <strong>${correction.fixed}</strong><br>` +
      `💡 ${correction.note}`;
  }

  elements.conversation.appendChild(el);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function showTypingIndicator(show) {
  elements.typingIndicator.style.display = show ? 'flex' : 'none';
  if (show) elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function setMicState(state) {
  const btn = elements.micButton;
  btn.disabled = false;
  btn.classList.remove('recording');
  if (state === 'listening') {
    btn.classList.add('recording');
    if (elements.transcription) elements.transcription.textContent = '녹음 중...';
  } else if (state === 'processing') {
    btn.disabled = true;
    if (elements.transcription) elements.transcription.textContent = '변환 중...';
  } else {
    if (elements.transcription) elements.transcription.textContent = '';
  }
}

function updateNav(activeMode) {
  const current = activeMode || STATE.mode;
  elements.navTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === current);
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
  const unit = getUnit(getDataUnitId(STATE.unitId));
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

function setConversationUiVisible(visible) {
  const display = visible ? '' : 'none';
  elements.conversation.style.display = display;
  elements.transcriptionPanel.style.display = display;
  elements.fluencyBar.style.display = display;
  elements.fluencyBadge.style.display = display;
  elements.micContainer.style.display = display;
  if (elements.unitSelectorBtn) elements.unitSelectorBtn.style.visibility = visible ? '' : 'hidden';
}

function showStatsScreen() {
  elements.statsScreen.classList.remove('hidden');
  setConversationUiVisible(false);

  const userId = window.kocoUserId || '';
  const userIdEl = document.getElementById('statsUserId');
  if (userIdEl) userIdEl.textContent = `ID: ...${userId.slice(-8)}`;

  if (!window.loadUserStats) return;
  window.loadUserStats().then(stats => {
    if (!stats) return;

    document.getElementById('statStreak').textContent = stats.streak;
    document.getElementById('statTotalTime').textContent = stats.totalMinutes;
    document.getElementById('statSessions').textContent = stats.totalSessions;
    document.getElementById('statCorrections').textContent = stats.totalCorrections;

    const corrEl = document.getElementById('recentCorrections');
    if (stats.recentCorrections.length === 0) {
      corrEl.innerHTML = '<p class="stats-empty">아직 교정 내역이 없어요.</p>';
    } else {
      corrEl.innerHTML = stats.recentCorrections.map(c =>
        `<div class="correction-item">🔧 <strong>${c.original_text}</strong> → ${c.corrected_text}<br><span style="color:#888;font-size:0.78em">💡 ${c.error_type || ''}</span></div>`
      ).join('');
    }

    const unitsEl = document.getElementById('studiedUnits');
    if (stats.studiedUnits.length === 0) {
      unitsEl.innerHTML = '<p class="stats-empty">아직 학습한 단원이 없어요.</p>';
    } else {
      unitsEl.innerHTML = stats.studiedUnits.map(u =>
        `<span class="unit-tag">${u}</span>`
      ).join('');
    }
  });
}

function hideStatsScreen() {
  elements.statsScreen.classList.add('hidden');
  setConversationUiVisible(true);
}

function updateMode(newMode) {
  if (newMode === 'stats') {
    updateNav('stats');
    showStatsScreen();
    return;
  }

  hideStatsScreen();

  if (!MODE_INFO[newMode]) return;
  STATE.mode = newMode;
  STATE.usedQuestions[newMode] = STATE.usedQuestions[newMode] || new Set();
  STATE.messageCount = 0;
  STATE.sessionCorrections = [];

  conversationManager.clear();
  elements.conversation.innerHTML = '';

  const unit = STATE.activeUnit;
  if (unit?.level && window.getGMSSentences) {
    const snuUnit = `${unit.level}_${unit.unit_number}`;
    window.getGMSSentences(snuUnit, 15).then(sentences => { STATE.gmsSentences = sentences; });
  }

  updateHeader();
  updateNav();
  nextQuestion();
}

//#endregion

//#region Push-to-talk (MediaRecorder + ElevenLabs STT)

const STT_ENDPOINT = isLocal ? 'http://localhost:3000/api/stt' : '/api/stt';

async function startRecording() {
  if (_isRecording || STATE.isSpeaking) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 16000 }
    });

    _audioChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    _mediaRecorder = new MediaRecorder(stream, { mimeType });
    _mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) _audioChunks.push(e.data);
    };

    _mediaRecorder.start(100);
    _isRecording = true;
    setMicState('listening');
    if (elements.transcription) elements.transcription.textContent = '녹음 중...';

  } catch (err) {
    console.error('Mic error:', err);
    showAlert('error', '마이크 접근이 거부되었습니다. 브라우저 설정을 확인하세요.');
  }
}

async function stopRecording() {
  if (!_isRecording || !_mediaRecorder) return '';
  _isRecording = false;
  setMicState('processing');
  if (elements.transcription) elements.transcription.textContent = '변환 중...';

  return new Promise((resolve) => {
    _mediaRecorder.onstop = async () => {
      const mimeType = _mediaRecorder.mimeType || 'audio/webm';
      const blob = new Blob(_audioChunks, { type: mimeType });
      _mediaRecorder.stream.getTracks().forEach(t => t.stop());
      _mediaRecorder = null;

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          const response = await fetch(STT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' })
          });
          if (!response.ok) throw new Error(`STT ${response.status}`);
          const { text } = await response.json();
          if (elements.transcription) elements.transcription.textContent = text || '';
          resolve(text || '');
        } catch (e) {
          console.error('STT error:', e);
          showAlert('error', 'STT 오류가 발생했습니다.');
          if (elements.transcription) elements.transcription.textContent = '';
          resolve('');
        } finally {
          setMicState('idle');
        }
      };
      reader.readAsDataURL(blob);
    };

    _mediaRecorder.stop();
  });
}

function initPushToTalk() {
  const micBtn = elements.micButton;
  if (!micBtn) return;

  micBtn.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    if (STATE.isSpeaking) return;
    if (elements.userTextInput?.value.trim()) return; // send mode — handle on pointerup
    await startRecording();
  });

  micBtn.addEventListener('pointerup', async (e) => {
    e.preventDefault();
    const inputText = elements.userTextInput?.value.trim();
    if (inputText) {
      submitTextInput();
      return;
    }
    if (!_isRecording) return;
    const text = await stopRecording();
    if (text && text.trim()) processUserInput(text.trim());
  });

  micBtn.addEventListener('pointerleave', async () => {
    if (_isRecording) {
      const text = await stopRecording();
      if (text && text.trim()) processUserInput(text.trim());
    }
  });
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

  const dataUnitId = getDataUnitId(STATE.unitId);
  const context = getSessionContext(dataUnitId, parseInt(STATE.activeUnit?.level?.[1] || '3', 10) || 3);
  context.unit = STATE.activeUnit || context.unit;
  const systemPrompt = generateSystemPrompt(context, STATE.mode, STATE.gmsSentences, STATE.pageContext);

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

    STATE.messageCount += 1;
    const { text: conversationText, correction } = parseCorrection(result.response);
    addMessage('assistant', conversationText);
    addCorrectionBlock(correction);
    if (correction && correction.status !== 'correct') {
      STATE.sessionCorrections.push(correction);
    }
    if (ttsEnabled) {
      await speakKorean(conversationText);
    }

    // Track detected structures, if any
    const detected = detectTargetStructures(text, context.targetStructures || []);
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

//#region Unit selector

const THEME_ICONS = {
  health: '🏥', society: '👥', environment: '🌿', culture: '🎭',
  work: '💼', language: '💬', daily_life: '🏠', technology: '💻'
};

function getThemeIcon(row) {
  const raw = (row.grand_themes?.slug || row.grand_themes?.label_en || '').toLowerCase().replace(/[\s-]+/g, '_');
  return THEME_ICONS[raw] || '📚';
}

let _pendingPhotoUnitId = null;

function toggleLevel(levelKey) {
  const el = document.getElementById('level-' + levelKey);
  if (!el) return;
  const arrow = el.previousElementSibling.querySelector('.level-arrow');
  const isOpen = el.style.display !== 'none';

  document.querySelectorAll('.level-units').forEach(u => {
    u.style.display = 'none';
    const a = u.previousElementSibling.querySelector('.level-arrow');
    if (a) a.textContent = '▶';
  });

  if (!isOpen) {
    el.style.display = 'block';
    if (arrow) arrow.textContent = '▼';
  }
}

async function buildUnitSelectorList() {
  const list = elements.unitSelectorList;
  if (!list) return;
  list.innerHTML = '<div style="padding:1rem;color:#999;text-align:center">불러오는 중...</div>';

  const allUnits = window.getAllSNUUnits ? await window.getAllSNUUnits() : [];

  list.innerHTML = '';

  if (allUnits.length === 0) {
    list.innerHTML = '<div style="padding:1rem;color:#999;text-align:center">단원을 불러올 수 없습니다.</div>';
    return;
  }

  const groups = {};
  allUnits.forEach(row => {
    const key = row.level || '?';
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  const activeLevel = STATE.activeUnit?.level
    || STATE.unitId.match(/snu_(\w+)_\d+_\d+/)?.[1]?.toUpperCase()
    || null;

  Object.keys(groups).sort().forEach(levelKey => {
    const isActiveLevel = levelKey === activeLevel;

    const groupEl = document.createElement('div');
    groupEl.className = 'level-group';

    const header = document.createElement('div');
    header.className = 'level-header' + (isActiveLevel ? ' level-header--active' : '');
    header.addEventListener('click', () => toggleLevel(levelKey));

    const badge = document.createElement('span');
    badge.className = 'level-badge' + (isActiveLevel ? ' level-badge--active' : '');
    badge.textContent = levelKey;

    const label = document.createElement('span');
    label.className = 'level-label';
    const count = groups[levelKey].length;
    label.textContent = `${count} leçon${count > 1 ? 's' : ''}`;

    const arrow = document.createElement('span');
    arrow.className = 'level-arrow';
    arrow.textContent = isActiveLevel ? '▼' : '▶';

    header.appendChild(badge);
    header.appendChild(label);
    header.appendChild(arrow);
    groupEl.appendChild(header);

    const unitsContainer = document.createElement('div');
    unitsContainer.className = 'level-units';
    unitsContainer.id = 'level-' + levelKey;
    unitsContainer.style.display = isActiveLevel ? 'block' : 'none';

    groups[levelKey].forEach(row => {
      const unit = normalizeSNUUnit(row);

      const itemEl = document.createElement('div');
      itemEl.className = 'unit-item' + (unit.id === STATE.unitId ? ' active' : '');
      itemEl.addEventListener('click', () => selectUnit(unit.id, unit));

      const numEl = document.createElement('span');
      numEl.className = 'unit-number';
      numEl.textContent = `${unit.unit_number}-${unit.lesson_number}`;

      const infoEl = document.createElement('div');
      infoEl.className = 'unit-info';

      const titleKoEl = document.createElement('span');
      titleKoEl.className = 'unit-title-ko';
      titleKoEl.textContent = unit.title;

      const titleEnEl = document.createElement('span');
      titleEnEl.className = 'unit-title-en';
      titleEnEl.textContent = unit.subtitle;

      infoEl.appendChild(titleKoEl);
      infoEl.appendChild(titleEnEl);

      const themeEl = document.createElement('span');
      themeEl.className = 'unit-theme-icon';
      themeEl.textContent = getThemeIcon(row);

      itemEl.appendChild(numEl);
      itemEl.appendChild(infoEl);
      itemEl.appendChild(themeEl);
      unitsContainer.appendChild(itemEl);
    });

    groupEl.appendChild(unitsContainer);
    list.appendChild(groupEl);
  });
}

function openUnitSelector() {
  buildUnitSelectorList();
  elements.unitSelectorModal.classList.remove('hidden');
}

function closeUnitSelector() {
  elements.unitSelectorModal.classList.add('hidden');
}

function selectUnit(unitId, unitObj) {
  STATE.unitId = unitId;
  STATE.activeUnit = unitObj || null;
  setTimeout(closeUnitSelector, 300);

  conversationManager.clear();
  elements.conversation.innerHTML = '';
  STATE.pageContext = null;

  if (window.getLessonContent) {
    window.getLessonContent(unitId).then(content => {
      if (content) STATE.pageContext = content;
    });
  }

  const unit = STATE.activeUnit;
  if (unit?.level && window.getGMSSentences) {
    window.getGMSSentences(`${unit.level}_${unit.unit_number}`, 15).then(sentences => {
      STATE.gmsSentences = sentences;
    });
  }

  updateHeader();
  nextQuestion();
}

//#endregion

//#region Drill du jour (SRS)

let drillItems = [];
let currentDrillIndex = 0;

async function checkDueReviews() {
  if (!window.getDueReviewItems) return;
  const items = await window.getDueReviewItems(window.kocoUserId);
  if (items.length === 0) return;

  const badge = document.getElementById('statsTabBadge');
  if (badge) {
    badge.textContent = items.length;
    badge.style.display = 'flex';
  }

  showDrillWidget(items);
}

function showDrillWidget(items) {
  const existing = document.getElementById('drillWidget');
  if (existing) existing.remove();

  const widget = document.createElement('div');
  widget.className = 'drill-widget';
  widget.id = 'drillWidget';
  widget.innerHTML = `
    <div class="drill-widget-header">
      <span class="drill-widget-icon">🧠</span>
      <div class="drill-widget-info">
        <span class="drill-widget-title">Drill du jour</span>
        <span class="drill-widget-count">${items.length} révision${items.length > 1 ? 's' : ''} en attente</span>
      </div>
      <button class="drill-widget-btn" id="drillWidgetStartBtn">Commencer →</button>
    </div>
  `;

  elements.conversation.prepend(widget);
  document.getElementById('drillWidgetStartBtn').addEventListener('click', startDrillSession);
}

async function startDrillSession() {
  if (!window.getDueReviewItems) return;
  const items = await window.getDueReviewItems(window.kocoUserId);
  if (items.length === 0) return;

  drillItems = items;
  currentDrillIndex = 0;
  showDrill(drillItems[0]);
}

function getDrillTypeLabel(type) {
  const labels = {
    recognition: '🔍 Recognition',
    recall: '🔄 Recall',
    production: '✍️ Production'
  };
  return labels[type] || type;
}

function showDrill(item) {
  const drillTypes = ['recognition', 'recall', 'production'];
  const drillType = drillTypes[currentDrillIndex % 3];

  let drillData;
  try {
    drillData = JSON.parse(item['drill_' + drillType]);
  } catch (e) {
    nextDrill();
    return;
  }

  const existing = document.getElementById('drillModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'drill-modal';
  modal.id = 'drillModal';

  const content = document.createElement('div');
  content.className = 'drill-modal-content';
  content.innerHTML = `
    <div class="drill-header">
      <span class="drill-type-badge">${getDrillTypeLabel(drillType)}</span>
      <span class="drill-progress">${currentDrillIndex + 1} / ${drillItems.length}</span>
    </div>
    <div class="drill-instruction">${drillData.instruction}</div>
    <div class="drill-prompt">${drillData.prompt}</div>
    <textarea class="drill-answer-input" id="drillAnswerInput" placeholder="답을 입력하세요..." rows="3"></textarea>
    <div class="drill-actions">
      <button class="drill-btn-skip" id="drillSkipBtn">건너뛰기</button>
      <button class="drill-btn-submit" id="drillSubmitBtn">확인 →</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  document.getElementById('drillSkipBtn').addEventListener('click', skipDrill);
  document.getElementById('drillSubmitBtn').addEventListener('click', () => submitDrill(item.id, drillType, drillData));
}

function submitDrill(itemId, drillType, drillData) {
  const answer = document.getElementById('drillAnswerInput')?.value?.trim();
  if (!answer) return;

  const item = drillItems.find(d => d.id === itemId);
  if (!item) return;

  const isProduction = drillType === 'production';
  const correctAnswer = drillData.answer || drillData.target_structure || '—';

  const content = document.querySelector('.drill-modal-content');
  if (!content) return;

  content.innerHTML = `
    <div class="drill-header">
      <span class="drill-type-badge">${getDrillTypeLabel(drillType)}</span>
      <span class="drill-progress">${currentDrillIndex + 1} / ${drillItems.length}</span>
    </div>
    <div class="drill-user-answer">
      <span class="drill-answer-label">Ta réponse</span>
      <div class="drill-answer-text">${answer}</div>
    </div>
    <div class="drill-correct-answer">
      <span class="drill-answer-label">${isProduction ? 'Structure cible' : 'Réponse correcte'}</span>
      <div class="drill-answer-text drill-answer-text--correct">${correctAnswer}</div>
    </div>
    <div class="drill-grade-prompt">Tu as réussi ?</div>
    <div class="drill-grade-actions">
      <button class="drill-grade-btn drill-grade-btn--miss" id="drillMissBtn">❌ Raté</button>
      <button class="drill-grade-btn drill-grade-btn--hard" id="drillHardBtn">😅 Difficile</button>
      <button class="drill-grade-btn drill-grade-btn--easy" id="drillEasyBtn">✅ Facile</button>
    </div>
  `;

  document.getElementById('drillMissBtn').addEventListener('click', () => gradeDrill(itemId, 'miss'));
  document.getElementById('drillHardBtn').addEventListener('click', () => gradeDrill(itemId, 'hard'));
  document.getElementById('drillEasyBtn').addEventListener('click', () => gradeDrill(itemId, 'easy'));
}

async function gradeDrill(itemId, grade) {
  if (window.updateReviewItem) {
    await window.updateReviewItem(itemId, grade);
  }
  nextDrill();
}

function skipDrill() {
  nextDrill();
}

function nextDrill() {
  currentDrillIndex++;
  if (currentDrillIndex >= drillItems.length) {
    closeDrillModal();
    const widget = document.getElementById('drillWidget');
    if (widget) widget.remove();
    const badge = document.getElementById('statsTabBadge');
    if (badge) badge.style.display = 'none';
    showAlert('success', '🧠 Drills terminés ! Bravo.');
    return;
  }
  showDrill(drillItems[currentDrillIndex]);
}

function closeDrillModal() {
  const modal = document.getElementById('drillModal');
  if (modal) modal.remove();
}

//#endregion

//#region Distillateur

async function runDistiller(corrections, unitId, userId) {
  if (!corrections || corrections.length === 0) return;

  console.log('Distillateur lancé pour', corrections.length, 'corrections');

  try {
    const endpoint = isLocal ? 'http://localhost:3000/api/distill' : '/api/distill';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corrections, unitId, userId })
    });

    if (!response.ok) throw new Error(`distill ${response.status}`);

    const { drills } = await response.json();

    if (drills && drills.length > 0 && window.saveReviewItems) {
      await window.saveReviewItems(userId, unitId, drills);
      console.log('Distillateur terminé:', drills.length, 'drills générés');
      showDistillerNotification(drills.length);
    }
  } catch (e) {
    console.error('Distillateur error:', e);
  }
}

function showDistillerNotification(count) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    background: #e8f5e9;
    border-left: 4px solid #00a884;
    padding: 12px 16px;
    margin: 12px 0;
    border-radius: 8px;
    font-size: 14px;
    color: #1a1a1a;
  `;
  notif.textContent = `🧠 ${count} drill${count > 1 ? 's' : ''} généré${count > 1 ? 's' : ''} depuis tes erreurs → disponibles dans Drill du jour`;

  const gmsEl = document.getElementById('summaryGMS');
  if (gmsEl) gmsEl.after(notif);
}

//#endregion

//#region Session summary
function openSessionSummary() {
  const durationMin = Math.round((Date.now() - STATE.session.sessionStart) / 60000);
  const corrections = STATE.sessionCorrections;

  document.getElementById('summaryDuration').textContent = `${durationMin} min`;
  document.getElementById('summaryMessages').textContent = STATE.messageCount;
  document.getElementById('summaryCorrections').textContent = corrections.length;

  const detailEl = document.getElementById('summaryCorrectionsDetail');
  if (corrections.length === 0) {
    detailEl.innerHTML = '<p style="color:#999;font-size:0.85em;text-align:center;margin:8px 0">Aucune correction cette séance 🎉</p>';
  } else {
    const last5 = corrections.slice(-5);
    detailEl.innerHTML = '<div style="margin-top:12px">' +
      last5.map(c =>
        `<div class="correction-block correction-block--${c.status}" style="margin:4px 0">` +
        `🔧 <strong>${c.original}</strong> → <strong>${c.fixed}</strong><br>` +
        `💡 ${c.note}</div>`
      ).join('') +
      '</div>';
  }

  const gmsEl = document.getElementById('summaryGMS');
  if (STATE.gmsSentences.length > 0) {
    gmsEl.innerHTML =
      '<p style="font-size:0.8em;color:#666;font-weight:700;margin:12px 0 6px">Phrases GMS de l\'unité</p>' +
      STATE.gmsSentences.slice(0, 3).map(s =>
        `<div style="font-size:0.82em;padding:6px 8px;background:#f8f9fa;border-radius:6px;margin:4px 0">` +
        `${s.text_kr} <span style="color:#999">— ${s.text_en}</span></div>`
      ).join('');
  } else {
    gmsEl.innerHTML = '';
  }

  console.log('Session ending - messages:', STATE.messageCount);
  console.log('Session ending - corrections:', corrections?.length);
  console.log('Session ending - duration:', durationMin, 'min');

  if (window.saveSession) {
    saveSession(STATE.unitId, STATE.mode, durationMin, corrections);
  }

  const majorCorrections = corrections.filter(c => c.status !== 'correct');
  if (majorCorrections.length > 0) {
    runDistiller(majorCorrections, STATE.unitId, window.kocoUserId);
  }

  elements.sessionSummaryModal.classList.remove('hidden');
}

function closeSessionSummary() {
  elements.sessionSummaryModal.classList.add('hidden');
}

function resetSession() {
  conversationManager.clear();
  elements.conversation.innerHTML = '';
  STATE.messageCount = 0;
  STATE.sessionCorrections = [];
  STATE.session.sessionStart = Date.now();
  STATE.session.exchangeCount = 0;
  STATE.session.totalUserWords = 0;
  STATE.session.totalUserResponses = 0;
  STATE.session.structureHits = new Set();
  updateFluencyIndicator();

  const unit = STATE.activeUnit;
  if (unit?.level && window.getGMSSentences) {
    const snuUnit = `${unit.level}_${unit.unit_number}`;
    window.getGMSSentences(snuUnit, 15).then(sentences => {
      STATE.gmsSentences = sentences;
    });
  }

  nextQuestion();
}

//#endregion

//#region Photo analysis
function addSystemMessage(text) {
  const el = document.createElement('div');
  el.className = 'message message--system';
  el.textContent = text;
  elements.conversation.appendChild(el);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
  return el;
}

function initPhotoInput() {
  elements.photoInputBtn.addEventListener('click', () => {
    _pendingPhotoUnitId = null;
    elements.photoFileInput.click();
  });

  elements.photoFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    elements.photoFileInput.value = '';

    const targetUnitId = _pendingPhotoUnitId || STATE.unitId;
    _pendingPhotoUnitId = null;

    const fromModal = !!_pendingPhotoUnitId;
    const indicator = fromModal ? null : addSystemMessage('📸 Analyse en cours...');

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const unit = targetUnitId === STATE.unitId ? STATE.activeUnit : null;
      const snuUnit = unit ? `${unit.level}_${unit.unit_number}-${unit.lesson_number}` : 'SNU 5A';
      const endpoint = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
        ? 'http://localhost:3000/api/analyze-image'
        : '/api/analyze-image';

      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, snuUnit })
        });
        if (!resp.ok) throw new Error('analyze-image failed');
        const ctx = await resp.json();

        // Save to Supabase
        if (window.saveLessonContent) {
          await window.saveLessonContent(targetUnitId, ctx);
        }

        // If for current unit, update pageContext
        if (targetUnitId === STATE.unitId) {
          STATE.pageContext = ctx;
        }

        // Update photo button in modal if still open
        const photoBtn = document.querySelector(`.unit-selector-item__photo[data-unit-id="${targetUnitId}"]`);
        if (photoBtn) photoBtn.classList.add('has-content');

        if (indicator) {
          indicator.textContent = '✅ Page analysée ! Vocabulaire et structures chargés.';
          indicator.classList.add('message--system-ok');
        } else {
          showAlert('success', `✅ Page analysée pour ${unit?.title || targetUnitId}`);
        }
      } catch (err) {
        console.error('Photo analysis error:', err);
        if (indicator) indicator.textContent = '❌ Analyse échouée. Réessayez.';
        else showAlert('error', '❌ Analyse échouée.');
      }
    };
    reader.readAsDataURL(file);
  });
}

//#endregion

//#region Input bar

const SEND_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
    stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const MIC_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="#ffffff"/>
  <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
    stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
</svg>`;

function syncMicSendState() {
  const micBtn = elements.micButton;
  const hasText = elements.userTextInput.value.trim().length > 0;
  if (hasText) {
    micBtn.className = 'wa-btn wa-send';
    micBtn.innerHTML = SEND_SVG;
  } else {
    micBtn.className = 'wa-btn wa-mic';
    micBtn.innerHTML = MIC_SVG;
  }
}

function submitTextInput() {
  const textarea = elements.userTextInput;
  const text = textarea.value.trim();
  if (!text) return;
  textarea.value = '';
  textarea.style.height = 'auto';
  syncMicSendState();
  processUserInput(text);
}

function initInputBar() {
  const textarea = elements.userTextInput;
  if (!textarea) return;

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    syncMicSendState();
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitTextInput();
    }
  });
}

//#endregion

//#region Initialization
function initApp() {
  conversationManager = new ConversationManager();
  STATE.session.sessionStart = Date.now();

  // Register DOM events
  elements.nextQuestionButton.addEventListener('click', () => nextQuestion());

  elements.unitSelectorBtn.addEventListener('click', openUnitSelector);
  elements.unitSelectorModal.querySelector('.unit-selector-overlay').addEventListener('click', closeUnitSelector);

  elements.endSessionBtn.addEventListener('click', openSessionSummary);
  elements.sessionSummaryModal.querySelector('.summary-overlay').addEventListener('click', closeSessionSummary);
  document.getElementById('summaryContinue').addEventListener('click', closeSessionSummary);
  document.getElementById('summaryNewSession').addEventListener('click', () => {
    closeSessionSummary();
    resetSession();
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

  if (!elements.ttsToggleButton) {
    elements.ttsToggleButton = document.getElementById('ttsToggleBtn') || document.querySelector('.tts-toggle');
  }
  if (elements.ttsToggleButton) {
    elements.ttsToggleButton.addEventListener('click', toggleTts);
  }
  updateTtsButton();

  initPushToTalk();
  initInputBar();
  initPhotoInput();

  if (window.getAllSNUUnits) {
    window.getAllSNUUnits().then(allUnits => {
      const firstRow = allUnits.find(u => u.id === STATE.unitId) || allUnits[0];
      if (firstRow) {
        STATE.unitId = firstRow.id;
        STATE.activeUnit = normalizeSNUUnit(firstRow);
        const snuUnit = `${firstRow.level}_${firstRow.unit_number}`;
        if (window.getGMSSentences) {
          window.getGMSSentences(snuUnit, 15).then(sentences => {
            STATE.gmsSentences = sentences;
            console.log(`GMS: ${sentences.length} phrases chargées pour ${snuUnit}`);
          });
        }
        updateHeader();
      }
    });
  }

  checkDueReviews();

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
