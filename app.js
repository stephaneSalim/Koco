/**
 * KoCo — Korean Conversation Companion
 * app.js — Application logic, modes, speech recognition, localStorage
 */

let _currentTtsAudio = null; // hoisted — AudioGate.setMuted() needs this
let sessionTargetsUsed = new Set();

// ── AudioGate — protects ElevenLabs credits by aborting fetch on mute ──────
const AudioGate = {
  muted: localStorage.getItem('koco_tts_enabled') === 'false',
  activeController: null,

  isMuted() { return this.muted; },

  setMuted(val) {
    this.muted = val;
    localStorage.setItem('koco_tts_enabled', !val);

    if (val && this.activeController) {
      this.activeController.abort();
      this.activeController = null;
      console.log('AudioGate: ElevenLabs request aborted — muted');
    }

    if (val && _currentTtsAudio) {
      _currentTtsAudio.pause();
      _currentTtsAudio.src = '';
      _currentTtsAudio = null;
    }
  },

  createController() {
    if (this.activeController) this.activeController.abort();
    this.activeController = new AbortController();
    return this.activeController;
  },

  clearController() { this.activeController = null; }
};
window.AudioGate = AudioGate;
// ────────────────────────────────────────────────────────────────────────────

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
    structureHits: new Set(),
    goldenSentence: null
  },
  gmsSentences: [],
  isSpeaking: false,
  messageCount: 0,
  sessionCorrections: [],
  pageContext: null,
  currentSNUMission: null,
  selectedMissionFormat: null,
  needsFrenchExplanation: false,
  knowledgeSnapshot: null
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
  debate: { icon: '⚖️', label: '토론' },
  mission: { icon: '🎯', label: '미션' }
};

let conversationManager;
let _mediaRecorder = null;
let _audioChunks = [];
let _isRecording = false;

const elements = {
  headerUnitTitle: document.getElementById('headerUnitTitle'),
  headerUnitSubtitle: document.getElementById('headerUnitSubtitle'),
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
  mapScreen: document.getElementById('mapScreen'),
  transcriptionPanel: document.querySelector('.transcription-panel'),
  fluencyBar: document.querySelector('.fluency-bar'),
  fluencyBadge: document.querySelector('.fluency-badge'),
  micContainer: document.querySelector('.wa-input-bar')
};

let ttsPulseInterval = null;

function createTtsToggleButton() {
  const existing = document.getElementById('ttsToggleBtn');
  if (existing) {
    existing.addEventListener('click', toggleTts);
    return existing;
  }
  return null;
}

function updateTtsButton() {
  const muted = AudioGate.isMuted();
  const btn = document.getElementById('ttsToggle') || elements.ttsToggleButton;
  if (!btn) return;
  btn.textContent = muted ? '🔇' : '🔊';
  btn.classList.toggle('muted', muted);
  btn.setAttribute('aria-label', muted ? 'Son désactivé' : 'Son activé');
}

function toggleTTS() {
  const newMuted = !AudioGate.isMuted();
  AudioGate.setMuted(newMuted);
  const btn = document.getElementById('ttsToggle');
  if (btn) {
    btn.textContent = newMuted ? '🔇' : '🔊';
    btn.classList.toggle('muted', newMuted);
    btn.setAttribute('aria-label', newMuted ? 'Son désactivé' : 'Son activé');
  }
}

function toggleTts() {
  toggleTTS();
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

function stopTts() {
  stopTtsPulse();
  if (_currentTtsAudio) {
    _currentTtsAudio.pause();
    _currentTtsAudio.src = '';
    _currentTtsAudio = null;
  }
  AudioGate.clearController();
}

function cleanForTTS(text) {
  return text
    .replace(/\[CORRECTION\][\s\S]*?\[\/CORRECTION\]/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .trim();
}

async function speakKorean(text) {
  // GATE 1 — blocked before any network call
  if (AudioGate.isMuted()) {
    console.log('AudioGate: TTS blocked — muted');
    return;
  }

  // GATE 2 — stop any previous audio
  if (_currentTtsAudio) {
    _currentTtsAudio.pause();
    _currentTtsAudio.src = '';
    _currentTtsAudio = null;
  }

  const cleaned = cleanForTTS(text);
  if (!cleaned || cleaned.length < 2) return;

  STATE.isSpeaking = true;
  startTtsPulse();

  const done = () => {
    STATE.isSpeaking = false;
    stopTtsPulse();
    setMicState('idle');
    _currentTtsAudio = null;
    AudioGate.clearController();
  };

  // GATE 3 — AbortController ties fetch lifecycle to mute state
  const controller = AudioGate.createController();

  try {
    const resp = await fetch(API_CONFIG.TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleaned }),
      signal: controller.signal
    });

    // GATE 4 — check after round-trip (user may have muted while waiting)
    if (AudioGate.isMuted()) {
      console.log('AudioGate: response received but muted — discarded');
      done();
      return;
    }

    if (!resp.ok) throw new Error(`TTS ${resp.status}`);

    const data = await resp.json();

    if (data.skipped) {
      done();
      return;
    }

    // GATE 5 — check before playback
    if (AudioGate.isMuted()) { done(); return; }

    const bytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    const audioEl = new Audio(url);
    _currentTtsAudio = audioEl;
    audioEl.onended = () => { URL.revokeObjectURL(url); done(); };
    audioEl.onerror = () => { URL.revokeObjectURL(url); done(); };
    await audioEl.play();

  } catch (e) {
    if (e.name === 'AbortError') {
      console.log('AudioGate: fetch aborted cleanly');
    } else {
      console.warn('TTS error:', e.message);
    }
    done();
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

function updateHeaderBadge(unit) {
  const titleEl = document.getElementById('headerUnitTitle');
  const subtitleEl = document.getElementById('headerUnitSubtitle');
  const badgeEl = document.getElementById('unitSelectorBtn');

  if (!titleEl || !subtitleEl) return;

  badgeEl?.classList.add('updating');
  setTimeout(() => {
    titleEl.textContent = unit?.title || unit?.title_ko || '자유 주제';
    const level = unit?.level || '';
    const sub = unit?.subtitle || unit?.title_en || '';
    subtitleEl.textContent = level && sub ? `${level} · ${sub}` : level || sub || '';
    badgeEl?.classList.remove('updating');
  }, 150);
}

function updateHeader() {
  updateHeaderBadge(STATE.activeUnit);
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
      note: get('NOTE'),
      target_used: get('TARGET_USED') || '',
      anki_ready: get('ANKI_READY') === 'true'
    }
  };
}

function parseGoldenSentence(text) {
  const match = text.match(/\[GOLDEN_SENTENCE\]([\s\S]*?)\[\/GOLDEN_SENTENCE\]/);
  if (!match) return null;
  const block = match[1];
  const get = (field) => {
    const m = block.match(new RegExp(field + ':\\s*(.+)'));
    return m ? m[1].trim() : '';
  };
  return {
    sentence: get('SENTENCE'),
    why: get('WHY'),
    structures_detected: get('STRUCTURES_DETECTED')
  };
}

function parseSpeakResponse(text) {
  const match = text.match(/\[SPEAK_RESPONSE\]([\s\S]*?)\[\/SPEAK_RESPONSE\]/);
  if (!match) return null;
  const block = match[1];
  const extract = (field) => {
    const m = block.match(new RegExp(field + ':\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)'));
    return m ? m[1].trim() : '';
  };
  return {
    validation:     extract('VALIDATION'),
    native_polish:  extract('NATIVE_POLISH'),
    native_reason:  extract('NATIVE_REASON'),
    target_used:    extract('TARGET_USED'),
    pivot_question: extract('PIVOT_QUESTION')
  };
}

function buildTargetsStatus(allTargets, currentTargetUsed) {
  if (!allTargets?.length) return [];
  if (currentTargetUsed) sessionTargetsUsed.add(currentTargetUsed);
  return allTargets.slice(0, 5).map(g => ({ grammar: g, used: sessionTargetsUsed.has(g) }));
}

function updateSessionTargets(targetUsed) {
  if (!targetUsed) return;
  sessionTargetsUsed.add(targetUsed);
}

function resetSessionState() {
  sessionTargetsUsed = new Set();
}

function renderFeedbackCard(speakData, correction, sessionTargets) {
  if (!speakData) return null;
  const targetsStatus = buildTargetsStatus(sessionTargets, speakData.target_used);

  const card = document.createElement('div');
  card.className = 'feedback-card';
  card.innerHTML = `
    <div class="feedback-validation">
      <span class="feedback-koco-label">KoCo</span>
      <p class="feedback-validation-text">${speakData.validation}</p>
    </div>
    ${speakData.native_polish ? `
    <div class="feedback-polish">
      <div class="feedback-polish-header">
        <span class="feedback-polish-icon">💡</span>
        <span class="feedback-polish-label">네이티브처럼</span>
      </div>
      <div class="feedback-polish-sentence">${speakData.native_polish}</div>
      ${speakData.native_reason ? `<div class="feedback-polish-reason">${speakData.native_reason}</div>` : ''}
    </div>` : ''}
    ${targetsStatus.length > 0 ? `
    <div class="feedback-progress">
      ${targetsStatus.map(t =>
        `<span class="feedback-target ${t.used ? 'used' : 'pending'}">${t.used ? '✅' : '⏳'} ${t.grammar}</span>`
      ).join('')}
    </div>` : ''}
    <div class="feedback-pivot">
      <div class="feedback-pivot-line"></div>
      <p class="feedback-pivot-text">${speakData.pivot_question}</p>
    </div>
  `;
  return card;
}

function addSpeakMessage(rawResponse) {
  const speakData = parseSpeakResponse(rawResponse);
  const { correction } = parseCorrection(rawResponse);

  if (speakData) {
    const card = renderFeedbackCard(
      speakData,
      correction,
      MissionMgr.override?.target_grammar || []
    );
    if (card) {
      const wrapper = document.createElement('div');
      wrapper.classList.add('message', 'message--assistant');
      wrapper.appendChild(card);
      elements.conversation.appendChild(wrapper);
      elements.conversation.scrollTop = elements.conversation.scrollHeight;
    }

    const ttsText = [speakData.validation, speakData.native_polish, speakData.pivot_question]
      .filter(Boolean).join(' ');
    if (!AudioGate.isMuted()) speakKorean(ttsText);

    addCorrectionBlock(correction);

    if (speakData.target_used) updateSessionTargets(speakData.target_used);

  } else {
    addMessage('assistant', rawResponse);
  }

  return { correction };
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

function showMapScreen() {
  if (!elements.mapScreen) return;
  elements.mapScreen.classList.remove('hidden');
  elements.statsScreen?.classList.add('hidden');
  setConversationUiVisible(false);
  // Monte React si Babel n'a pas encore fini (timing mobile)
  if (typeof window.mountKoCoMap === 'function') window.mountKoCoMap();
}

function hideMapScreen() {
  elements.mapScreen?.classList.add('hidden');
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
    hideMapScreen();
    showStatsScreen();
    return;
  }

  if (newMode === 'map') {
    updateNav('map');
    hideStatsScreen();
    showMapScreen();
    return;
  }

  hideStatsScreen();
  hideMapScreen();

  if (!MODE_INFO[newMode]) return;

  if (STATE.mode === 'mission' && newMode !== 'mission') {
    MissionMgr.deactivate();
  }

  STATE.mode = newMode;
  STATE.usedQuestions[newMode] = STATE.usedQuestions[newMode] || new Set();
  STATE.messageCount = 0;
  STATE.sessionCorrections = [];

  if (newMode === 'mission') {
    MissionMgr.activate(STATE.unitId);
  }

  document.getElementById('btnMission')?.classList.toggle('active', newMode === 'mission');
  document.getElementById('btnSpeak')?.classList.toggle('active', newMode !== 'mission');

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
  context.unitId = STATE.unitId;
  context.missionOverride = MissionMgr.getContext();
  context.selectedScenario = MissionMgr.selectedScenario || null;

  if (STATE.mode === 'daily_life' && window.fetchHybridContext) {
    context.hybridContext = await window.fetchHybridContext(window.kocoUserId, text);
  }

  // French valve: user asked for explanation inside SNU mission
  if (text.includes('설명해 주세요') && STATE.currentSNUMission) {
    STATE.needsFrenchExplanation = true;
  }
  context.needsFrenchExplanation = STATE.needsFrenchExplanation;
  context.knowledgeSnapshot = STATE.knowledgeSnapshot;

  const systemPrompt = generateSystemPrompt(context, STATE.mode, STATE.gmsSentences, STATE.pageContext);
  STATE.needsFrenchExplanation = false; // reset after prompt built

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

    let correction;
    if (STATE.mode === 'speak') {
      const result2 = addSpeakMessage(result.response);
      correction = result2.correction;
    } else {
      const parsed = parseCorrection(result.response);
      correction = parsed.correction;
      addMessage('assistant', parsed.text);
      addCorrectionBlock(correction);
    }

    if (correction && correction.status !== 'correct') {
      STATE.sessionCorrections.push(correction);
    }

    if (STATE.mode === 'mission') {
      MissionMgr.incrementExchange();
      const missionScore = MissionMgr.parseScore(result.response);
      if (missionScore) {
        showMissionScore(missionScore);
        if (window.saveMissionMetrics) {
          window.saveMissionMetrics(missionScore, STATE.unitId, MissionMgr.getContext());
        }
        const drillSession = parseDrillSession(result.response);
        if (drillSession) showMissionDrills(drillSession);
        MissionMgr.deactivate();
      }
    }

    // Golden Sentence detection (Speak mode)
    const goldenSentence = parseGoldenSentence(result.response);
    if (goldenSentence?.sentence) {
      STATE.session.goldenSentence = goldenSentence;
    }

    if (STATE.mode !== 'speak' && !AudioGate.isMuted()) {
      const { text: convText } = parseCorrection(result.response);
      await speakKorean(convText);
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

      const dotEl = document.createElement('div');
      dotEl.className = 'unit-health-dot loading';
      dotEl.id = `health-dot-${unit.id}`;
      dotEl.title = 'Chargement...';

      itemEl.appendChild(numEl);
      itemEl.appendChild(infoEl);
      itemEl.appendChild(dotEl);
      unitsContainer.appendChild(itemEl);
    });

    groupEl.appendChild(unitsContainer);
    list.appendChild(groupEl);
  });

  // Passe 2 : charge les dots en arrière-plan
  if (window.getDataHealthCached) {
    allUnits.forEach(async row => {
      const unit = normalizeSNUUnit(row);
      const health = await window.getDataHealthCached(unit.id);
      const dot = document.getElementById(`health-dot-${unit.id}`);
      if (!dot) return;
      dot.style.background = health.color;
      dot.classList.remove('loading');
      dot.title = `${health.label} — ${health.wordCount} mots estimés`;
      if (health.wordCount === 0) {
        const titleEl = dot.closest('.unit-item')?.querySelector('.unit-title-ko');
        if (titleEl && !titleEl.querySelector('.unit-empty-label')) {
          const empty = document.createElement('span');
          empty.className = 'unit-empty-label';
          empty.textContent = ' (Vide)';
          titleEl.appendChild(empty);
        }
      }
    });
  }
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
  MissionMgr.deactivate();

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
  updateContextGuard(STATE.unitId);
  nextQuestion();
}
window.selectUnit = selectUnit;

async function updateContextGuard(unitId) {
  if (!window.getDataHealthCached) return;

  // In daily_life mode the GMS bank (3000 sentences) is always available
  if (STATE.mode === 'daily_life') {
    hideContextWarning();
    showGMSNotice();
    return;
  }

  const health = await window.getDataHealthCached(unitId);

  updateHeaderHealthIndicator(health);

  const btnMission = document.getElementById('btnMission');
  if (health.status === 'red') {
    if (btnMission) {
      btnMission.disabled = true;
      btnMission.style.opacity = '0.4';
      btnMission.title = '⚠️ Contenu insuffisant (min. 100 mots requis)';
    }
    showContextWarning(health);
  } else if (health.status === 'orange') {
    if (btnMission) {
      btnMission.disabled = false;
      btnMission.style.opacity = '1';
    }
    showContextWarning(health);
  } else {
    if (btnMission) {
      btnMission.disabled = false;
      btnMission.style.opacity = '1';
      btnMission.title = 'Mode Examen';
    }
    hideContextWarning();
  }

  return health;
}
window.updateContextGuard = updateContextGuard;

function updateHeaderHealthIndicator(health) {
  let indicator = document.getElementById('headerHealthDot');
  if (!indicator) {
    indicator = document.createElement('span');
    indicator.id = 'headerHealthDot';
    indicator.className = 'header-health-dot';
    document.getElementById('headerUnitTitle')?.appendChild(indicator);
  }
  indicator.style.background = health.color;
  indicator.title = `Contexte : ${health.label}`;
}

function showContextWarning(health) {
  const id = 'contextWarning-header';
  let warning = document.getElementById(id);
  if (!warning) {
    warning = document.createElement('div');
    warning.id = id;
    warning.className = 'context-warning-banner';
    document.getElementById('appHeader')?.insertAdjacentElement('afterend', warning);
  }
  warning.style.borderBottomColor = health.color + '30';
  warning.style.color = health.color;
  warning.style.background = health.status === 'red'
    ? 'rgba(229,57,53,0.08)'
    : 'rgba(247,147,30,0.08)';
  warning.textContent = health.status === 'red'
    ? "⚠️ Contenu insuffisant pour lancer l'IA (min. 100 mots requis). Ajoutez une photo 📸"
    : '⚠️ Contexte limité. Ajoutez une photo pour améliorer la précision de l\'IA.';
  warning.style.display = 'block';
}

function hideContextWarning() {
  const el = document.getElementById('contextWarning-header');
  if (el) el.style.display = 'none';
}

function showGMSNotice() {
  const id = 'gmsNotice-header';
  let notice = document.getElementById(id);
  if (!notice) {
    notice = document.createElement('div');
    notice.id = id;
    notice.className = 'context-warning-banner';
    document.getElementById('appHeader')?.insertAdjacentElement('afterend', notice);
  }
  notice.style.background = 'rgba(0,168,132,0.08)';
  notice.style.color = '#00a884';
  notice.style.borderBottomColor = '#00a88430';
  notice.textContent = '🌍 Mode Terrain — 3000 phrases GMS disponibles';
  notice.style.display = 'block';
}

function hideGMSNotice() {
  const el = document.getElementById('gmsNotice-header');
  if (el) el.style.display = 'none';
}

//#endregion

//#region Mission Engine — MissionManager

class MissionManager {
  constructor() {
    this.active = false;
    this.override = null;
    this.exchangeCount = 0;
    this.scoreDetected = false;
  }

  activate(unitId) {
    this.active = true;
    this.exchangeCount = 0;
    this.scoreDetected = false;
    this.override = null;

    const cfg = window.resolveMissionConfig ? window.resolveMissionConfig(unitId) : null;

    const level = cfg?.difficulty_level || '';
    if (level.startsWith('6') && cfg?.dynamic) {
      this.showDynamicFallbackNotice(level);
    }

    console.log('Mission activated:', cfg?.difficulty_level, '| severity:', cfg?.severity);
    return cfg;
  }

  showDynamicFallbackNotice(level) {
    const notif = document.createElement('div');
    notif.style.cssText = `
      background: linear-gradient(135deg, #6a1b9a, #4a148c);
      color: #e1bee7;
      border-radius: 10px;
      padding: 10px 14px;
      margin: 6px 16px;
      font-size: 13px;
    `;
    notif.innerHTML = `
      <strong style="color:#ce93d8">⚡ Niveau ${level} détecté</strong><br>
      Configuration dynamique activée — structures thèse chargées.<br>
      <span style="color:#9c27b0">📎 Importez une page de cours pour calibration précise.</span>
    `;
    const conv = document.querySelector('.conversation');
    if (conv) { conv.appendChild(notif); conv.scrollTop = conv.scrollHeight; }
  }

  deactivate() {
    this.active = false;
    this.override = null;
    this.exchangeCount = 0;
    this.scoreDetected = false;
  }

  calibrateFromVision(pageContent) {
    if (!this.active) return null;

    const baseConfig = window.resolveMissionConfig ? window.resolveMissionConfig(STATE.unitId) : {};

    const mergedGrammar = [
      ...new Set([
        ...(baseConfig.target_grammar || []),
        ...(pageContent.structures || [])
      ])
    ].slice(0, 6);

    const mergedVocab = [
      ...(baseConfig.vocabulary || []),
      ...(pageContent.vocabulary || [])
    ].slice(0, 15);

    this.override = {
      ...baseConfig,
      target_grammar: mergedGrammar,
      vocabulary: mergedVocab,
      topic: pageContent.theme || baseConfig.topic,
      mission_brief: pageContent.theme
        ? `${pageContent.theme}의 핵심 구조를 활용하여 ${baseConfig.mission_brief || '논리적으로 말하세요.'}`
        : (baseConfig.mission_brief || '논리적으로 말하세요.'),
      vision_merged: true,
      vision_additions: pageContent.structures || []
    };

    console.log('Mission MERGED from vision:', {
      base: baseConfig.target_grammar,
      added: pageContent.structures,
      merged: mergedGrammar
    });

    return this.override;
  }

  incrementExchange() {
    this.exchangeCount++;
    console.log('Mission exchange:', this.exchangeCount);
  }

  parseScore(text) {
    if (this.scoreDetected) return null;
    const match = text.match(/\[MISSION_SCORE\]([\s\S]*?)\[\/MISSION_SCORE\]/);
    if (!match) return null;

    this.scoreDetected = true;
    const block = match[1];

    const extract = (field) => {
      const m = block.match(new RegExp(field + ':\\s*(.+)'));
      return m ? m[1].trim() : '';
    };

    return {
      level:            extract('LEVEL'),
      structures_used:  extract('STRUCTURES_USED'),
      structures_missed: extract('STRUCTURES_MISSED'),
      forbidden_count:  parseInt(extract('FORBIDDEN_COUNT')) || 0,
      complexity_index: parseFloat(extract('COMPLEXITY_INDEX')) || 0,
      score:            extract('SCORE'),
      score_numeric:    parseFloat(extract('SCORE')) || 0,
      verdict:          extract('VERDICT')
    };
  }

  getContext() {
    return this.override || null;
  }
}

const MissionMgr = new MissionManager();
window.MissionMgr = MissionMgr;

function showMissionScore(score) {
  const el = document.createElement('div');
  el.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    color: #e0e0e0;
    border-radius: 14px;
    padding: 16px 18px;
    margin: 8px 0;
    font-size: 14px;
    line-height: 1.6;
  `;
  el.innerHTML = `
    <div style="font-size:16px;font-weight:800;color:#f7931e;margin-bottom:10px">
      🎯 미션 결과 [${score.level || '5A'}] — ${score.score} / 10
    </div>
    ${score.structures_used ? `<div>✅ <strong>사용 구조:</strong> ${score.structures_used}</div>` : ''}
    ${score.structures_missed ? `<div>❌ <strong>미사용 구조:</strong> ${score.structures_missed}</div>` : ''}
    ${score.forbidden_count ? `<div>⚠️ <strong>금지 표현 감지:</strong> ${score.forbidden_count}회</div>` : ''}
    <div>📊 <strong>복잡도:</strong> ${score.complexity_index}/10</div>
    ${score.verdict ? `<div style="margin-top:8px;color:#b0c4de;font-style:italic">"${score.verdict}"</div>` : ''}
  `;
  elements.conversation.appendChild(el);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function parseDrillSession(text) {
  const match = text.match(/\[DRILL_SESSION\]([\s\S]*?)\[\/DRILL_SESSION\]/);
  if (!match) return null;

  const block = match[1];
  const level = (block.match(/LEVEL:\s*(.+)/) || [])[1]?.trim();

  const drills = [];
  for (let i = 1; i <= 3; i++) {
    const extract = (field) => {
      const m = block.match(new RegExp(`DRILL_${i}_${field}:\\s*(.+)`));
      return m ? m[1].trim() : '';
    };
    const type = extract('TYPE');
    const prompt = extract('PROMPT');
    if (!type || !prompt) continue;
    drills.push({
      type,
      prompt,
      target: extract('TARGET'),
      answer: extract('ANSWER'),
      level
    });
  }

  return drills.length ? { level, drills } : null;
}

function showMissionDrills(drillSession) {
  if (!drillSession?.drills?.length) return;

  const container = document.createElement('div');
  container.style.cssText = `
    background: #f8f9fa;
    border-radius: 16px;
    padding: 20px;
    margin: 12px 0;
    border-top: 4px solid #667eea;
  `;

  const typeLabel = (t) =>
    t === 'reformulation' ? '🔄 재구성' :
    t === 'completion'    ? '✏️ 완성'   : '✍️ 생성';
  const typeColor = (t) =>
    t === 'reformulation' ? '#ff6b35' :
    t === 'completion'    ? '#667eea' : '#00a884';
  const typePlaceholder = (t) =>
    t === 'completion'    ? '빈칸을 채우세요...' :
    t === 'reformulation' ? '재구성하세요...'     : '문장을 만드세요...';

  container.innerHTML = `
    <div style="font-size:16px;font-weight:700;color:#667eea;margin-bottom:16px">
      📝 드릴 세션 [${drillSession.level}]
      <span style="font-size:12px;font-weight:400;color:#8696A0;margin-left:8px">미션 오류 기반 즉석 연습</span>
    </div>
    ${drillSession.drills.map((drill, i) => `
      <div id="missionDrillItem_${i}" style="
        background:white;border-radius:12px;padding:16px;margin-bottom:12px;
        border-left:3px solid ${typeColor(drill.type)};
      ">
        <div style="font-size:11px;font-weight:700;color:#8696A0;text-transform:uppercase;margin-bottom:8px">
          ${i + 1}. ${typeLabel(drill.type)}
          <span style="background:#f0f0f0;border-radius:8px;padding:2px 8px;font-size:10px;margin-left:6px">${drill.target}</span>
        </div>
        <div style="font-size:15px;color:#1a1a1a;margin-bottom:12px;line-height:1.5">${drill.prompt}</div>
        <textarea
          id="missionDrillInput_${i}"
          data-correct="${drill.answer.replace(/"/g, '&quot;')}"
          placeholder="${typePlaceholder(drill.type)}"
          style="width:100%;border:2px solid #e5e5e5;border-radius:8px;padding:10px;font-size:14px;font-family:inherit;resize:none;outline:none;box-sizing:border-box"
          rows="2"
        ></textarea>
        <button
          onclick="checkMissionDrill(${i})"
          id="missionDrillCheckBtn_${i}"
          style="margin-top:8px;background:#667eea;color:white;border:none;border-radius:20px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;width:100%">
          확인 →
        </button>
        <div id="missionDrillResult_${i}" style="display:none;margin-top:8px"></div>
      </div>
    `).join('')}
  `;

  elements.conversation.appendChild(container);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;

  saveMissionDrillsToSRS(drillSession);
}

function checkMissionDrill(index) {
  const textarea = document.getElementById(`missionDrillInput_${index}`);
  const btn = document.getElementById(`missionDrillCheckBtn_${index}`);
  const resultDiv = document.getElementById(`missionDrillResult_${index}`);
  if (!textarea || !resultDiv) return;

  const userAnswer = textarea.value.trim();
  if (!userAnswer) return;

  const correct = textarea.dataset.correct;
  textarea.disabled = true;
  if (btn) btn.style.display = 'none';
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `
    <div style="padding:10px;border-radius:8px;background:#f8f9fa;font-size:13px;margin-bottom:8px">
      <div style="color:#8696A0;margin-bottom:4px">모범 답안:</div>
      <div style="color:#00a884;font-weight:500">${correct}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="rateMissionDrill(this, true, ${index})"
        style="flex:1;background:#e8f5e9;color:#00a884;border:none;border-radius:8px;padding:8px;font-size:13px;font-weight:600;cursor:pointer">
        ✅ 알았어요
      </button>
      <button onclick="rateMissionDrill(this, false, ${index})"
        style="flex:1;background:#fce4ec;color:#e53935;border:none;border-radius:8px;padding:8px;font-size:13px;font-weight:600;cursor:pointer">
        ❌ 몰랐어요
      </button>
    </div>
  `;
}

function rateMissionDrill(btn, success) {
  btn.parentElement.innerHTML = success
    ? '<div style="color:#00a884;font-size:13px;padding:6px 0">✅ SRS 업데이트됨</div>'
    : '<div style="color:#e53935;font-size:13px;padding:6px 0">❌ 내일 다시 복습</div>';
}

async function saveMissionDrillsToSRS(drillSession) {
  if (!drillSession?.drills?.length || !window.supabaseClient) return;

  const now = new Date().toISOString();
  const items = drillSession.drills.map(drill => ({
    user_id: window.kocoUserId,
    unit_id: STATE.unitId,
    original: drill.prompt,
    fixed: drill.answer,
    note: drill.target,
    drill_recognition: JSON.stringify({
      instruction: '재구성하세요:',
      prompt: drill.prompt,
      answer: drill.answer
    }),
    drill_recall: JSON.stringify({
      instruction: drill.type === 'completion' ? '완성하세요:' : '번역하세요:',
      prompt: drill.prompt,
      answer: drill.answer
    }),
    drill_production: JSON.stringify({
      instruction: '문장을 만드세요:',
      prompt: `${drill.target}을/를 사용하세요.`,
      target_structure: drill.target
    }),
    drills_generated_at: now,
    next_review_at: now,
    interval_days: 1
  }));

  const { error } = await window.supabaseClient.from('review_items').insert(items);
  if (error) {
    console.error('saveMissionDrillsToSRS error:', JSON.stringify(error));
  } else {
    console.log('Mission drills saved to SRS:', items.length);
  }
}

function showVisionMergeNotice(override) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    color: white;
    padding: 14px 16px;
    border-radius: 10px;
    margin: 8px 12px;
    font-size: 13px;
    border-left: 4px solid #00a884;
  `;
  notif.innerHTML = `
    ⚡ <strong>Mission recalibrée — Fusion Vision + Unité</strong><br>
    <small style="opacity:0.8">
      Ajouts Vision : ${(override.vision_additions || []).join(', ') || '—'}<br>
      Total structures : ${(override.target_grammar || []).length}
    </small>
  `;
  elements.conversation.appendChild(notif);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

async function bootstrapMissionFromImage(pageContent) {
  const override = MissionMgr.calibrateFromVision(pageContent);
  if (!override) return;
  showVisionMergeNotice(override);
}

function showMissionBriefing(cfg) {
  if (!cfg) return;

  const isThesis = cfg.severity === 'thesis' || (cfg.difficulty_level || '').startsWith('6');

  const grammarChips = (cfg.target_grammar || [])
    .map(g => `<span style="display:inline-block;background:#1a1a2e;color:#f7931e;border:1px solid #f7931e;border-radius:12px;padding:2px 10px;margin:2px;font-size:12px">${g}</span>`)
    .join('');

  const forbiddenChips = (cfg.forbidden_patterns || [])
    .map(p => `<span style="display:inline-block;background:#2d1a1a;color:#ef5350;border:1px solid #ef5350;border-radius:12px;padding:2px 10px;margin:2px;font-size:12px;text-decoration:line-through">${p}</span>`)
    .join('');

  const thesisExtras = isThesis ? `
    <div style="margin-top:10px;padding:8px 12px;background:#1a0533;border-left:3px solid #ce93d8;border-radius:0 8px 8px 0;font-size:12px;color:#e1bee7">
      📜 <strong style="color:#ce93d8">THESIS MODE</strong> — 지시어 금지 · 격식체 의무 · 한자어 필수 · 반복 패턴 제재
    </div>` : '';

  const el = document.createElement('div');
  el.style.cssText = `
    background: linear-gradient(135deg, #0d1117, #161b22);
    border: 1px solid #f7931e44;
    border-radius: 14px;
    padding: 14px 16px;
    margin: 6px 0;
    font-size: 13px;
    color: #cdd9e5;
    line-height: 1.7;
  `;
  el.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#f7931e;margin-bottom:8px">
      🎯 미션 브리핑 [${cfg.difficulty_level}]
    </div>
    <div style="color:#8b949e;margin-bottom:6px">${cfg.mission_brief}</div>
    <div style="margin-bottom:4px"><span style="color:#58a6ff">📐 목표 구조:</span><br>${grammarChips}</div>
    <div style="margin-top:6px"><span style="color:#ef5350">🚫 금지 표현:</span><br>${forbiddenChips}</div>
    <div style="margin-top:8px;color:#8b949e;font-size:12px">
      최소 절 수: ${cfg.min_clauses || 2} | 허용 오차: ${cfg.tolerance || 'low'}
    </div>
    ${thesisExtras}
  `;
  elements.conversation.appendChild(el);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

async function generateMissionConstraints(unitId) {
  console.log('Generating mission constraints for:', unitId);

  const [lessonData, weakPoints, baseConfig] = await Promise.all([
    window.getLessonConstraints ? window.getLessonConstraints(unitId) : Promise.resolve(null),
    window.getWeakPoints ? window.getWeakPoints(window.kocoUserId, 3) : Promise.resolve([]),
    Promise.resolve(window.resolveMissionConfig ? window.resolveMissionConfig(unitId) : {})
  ]);

  const weakStructures = weakPoints.map(w => w.note).filter(Boolean).slice(0, 2);
  const lessonStructures = (lessonData?.structures || []).slice(0, 2);
  const baseStructures = (baseConfig.target_grammar || []).slice(0, 3);

  const grammarSheet = [...new Set([
    ...weakStructures, ...lessonStructures, ...baseStructures
  ])].slice(0, 5);

  const lessonVocab = (lessonData?.vocabulary || []).slice(0, 8);
  const weakVocab = weakPoints.map(w => w.fixed).filter(Boolean).slice(0, 4);
  const vocabSheet = [...new Set([...lessonVocab, ...weakVocab])].slice(0, 12);

  const missionSheet = {
    grammar: grammarSheet,
    vocabulary: vocabSheet,
    weak_points: weakPoints,
    base_config: baseConfig,
    unit_id: unitId,
    generated_at: new Date().toISOString(),
    sources: {
      weak_structures: weakStructures.length,
      lesson_structures: lessonStructures.length,
      base_structures: baseStructures.length,
      lesson_vocab: lessonVocab.length,
      weak_vocab: weakVocab.length
    }
  };

  console.log('Mission Sheet generated:', {
    grammar: grammarSheet,
    vocab_count: vocabSheet.length,
    sources: missionSheet.sources
  });

  return missionSheet;
}
window.generateMissionConstraints = generateMissionConstraints;

function showMissionSheet(sheet) {
  const cfg = sheet.base_config;
  const isThesis = cfg.severity === 'thesis';
  const hasWeakPoints = sheet.weak_points?.length > 0;

  const container = document.createElement('div');
  container.className = 'mission-sheet';
  container.style.cssText = `
    background: ${isThesis
      ? 'linear-gradient(135deg, #1a1a2e, #16213e)'
      : 'linear-gradient(135deg, #ff6b35, #f7931e)'};
    border-radius: 16px;
    padding: 20px;
    margin: 12px 0;
    color: white;
  `;

  container.innerHTML = `
    <div style="font-size:17px;font-weight:700;margin-bottom:4px">
      🎯 Mission Sheet [${cfg.difficulty_level || ''}]
    </div>
    <div style="font-size:13px;opacity:0.8;margin-bottom:16px">${cfg.mission_brief || ''}</div>

    <div style="margin-bottom:14px">
      <div style="font-size:11px;opacity:0.7;text-transform:uppercase;margin-bottom:6px">
        구조 목표 (${sheet.grammar.length}/5)
      </div>
      ${sheet.grammar.map(g => {
        const isWeak = sheet.weak_points?.some(w => w.note === g);
        return `<span style="display:inline-block;background:${
          isWeak ? 'rgba(255,59,48,0.3)' : 'rgba(255,255,255,0.15)'
        };border-radius:10px;padding:4px 10px;font-size:12px;margin:2px;${
          isWeak ? 'border:1px solid rgba(255,59,48,0.5)' : ''
        }">${isWeak ? '⚠️ ' : ''}${g}</span>`;
      }).join('')}
    </div>

    ${sheet.vocabulary.length > 0 ? `
    <div style="margin-bottom:14px">
      <div style="font-size:11px;opacity:0.7;text-transform:uppercase;margin-bottom:6px">
        어휘 (${sheet.vocabulary.length}/12)
      </div>
      <div style="font-size:12px;opacity:0.85;line-height:1.6">
        ${sheet.vocabulary.slice(0, 12).join(' · ')}
      </div>
    </div>` : ''}

    ${hasWeakPoints ? `
    <div style="background:rgba(255,59,48,0.2);border-radius:10px;padding:10px 12px;
      margin-bottom:14px;border-left:3px solid rgba(255,59,48,0.6)">
      <div style="font-size:11px;opacity:0.8;margin-bottom:4px">⚠️ POINTS FAIBLES DÉTECTÉS</div>
      ${sheet.weak_points.map(w => `
        <div style="font-size:12px;margin:2px 0">
          <span style="opacity:0.7">${w.original || ''}</span>
          <span style="opacity:0.5"> → </span>
          <span>${w.fixed || ''}</span>
          <span style="font-size:10px;opacity:0.6;margin-left:4px">(${w.interval_days || 1}j)</span>
        </div>`).join('')}
    </div>` : ''}

    <div style="margin-bottom:14px">
      <div style="font-size:11px;opacity:0.7;text-transform:uppercase;margin-bottom:6px">금지 표현</div>
      ${(cfg.forbidden_patterns || []).map(p =>
        `<span style="display:inline-block;background:rgba(0,0,0,0.25);border-radius:10px;
          padding:3px 8px;font-size:12px;margin:2px;text-decoration:line-through;opacity:0.8">${p}</span>`
      ).join('')}
    </div>

    <div style="font-size:10px;opacity:0.5;text-align:right">
      Sources: ${sheet.sources.weak_structures} weak ·
      ${sheet.sources.lesson_structures} page ·
      ${sheet.sources.base_structures} config
    </div>
  `;

  elements.conversation.appendChild(container);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function setMode(mode) {
  document.getElementById('btnSpeak')?.classList.toggle('active', mode === 'speak');
  document.getElementById('btnMission')?.classList.toggle('active', mode === 'mission');
  document.getElementById('btnDailyLife')?.classList.toggle('active', mode === 'daily_life');

  if (mode === 'speak') {
    if (STATE.mode === 'mission') {
      updateMode('freeChat');
      elements.navTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === 'freeChat'));
    }
    hideGMSNotice();
    STATE.mode = 'speak';
    showModeNotification('💬', 'Mode Tutorat', 'Coach flexible — correction douce');
  } else if (mode === 'mission') {
    hideGMSNotice();
    toggleMissionMode();
    showModeNotification('🎯', 'Mode Examen', 'Proctor strict — tolérance zéro');
  } else if (mode === 'daily_life') {
    if (STATE.mode === 'mission') MissionMgr.deactivate();
    STATE.mode = 'daily_life';
    hideContextWarning();
    showGMSNotice();
    showModeNotification('🌍', 'Mode Terrain', 'Vie quotidienne — RAG personnel actif');
  }

  console.log('Mode switched to:', mode);
}

function showModeNotification(icon, title, subtitle) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.75);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 13px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 8px;
    backdrop-filter: blur(8px);
    animation: notifFadeIn 0.3s ease;
  `;
  notif.innerHTML = `
    <span style="font-size:16px">${icon}</span>
    <div>
      <div style="font-weight:700">${title}</div>
      <div style="font-size:11px;opacity:0.8">${subtitle}</div>
    </div>
  `;
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.animation = 'notifFadeOut 0.3s ease forwards';
    setTimeout(() => notif.remove(), 300);
  }, 2000);
}

async function showScenarioChoice(missionSheet) {
  const loaderEl = document.createElement('div');
  loaderEl.id = 'scenarioLoader';
  loaderEl.style.cssText = `
    background: rgba(102,126,234,0.08);
    border-radius: 16px;
    padding: 20px;
    margin: 12px 0;
    text-align: center;
    color: #667eea;
  `;
  loaderEl.innerHTML = `
    <div class="scenario-loader-anim">
      <div class="scenario-dot"></div>
      <div class="scenario-dot"></div>
      <div class="scenario-dot"></div>
    </div>
    <div style="font-size:13px;margin-top:10px;opacity:0.8">시나리오 생성 중...</div>
  `;
  elements.conversation.appendChild(loaderEl);
  loaderEl.scrollIntoView({ behavior: 'smooth' });

  try {
    const resp = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionSheet,
        unitTitle: STATE.activeUnit?.title || ''
      })
    });

    const { scenarios } = await resp.json();
    loaderEl.remove();
    if (!scenarios?.length) return;

    STATE.currentScenarios = scenarios;

    const container = document.createElement('div');
    container.id = 'scenarioChoice';
    container.style.cssText = 'margin: 12px 0; display: flex; flex-direction: column; gap: 10px;';
    container.innerHTML = `
      <div style="font-size:14px;color:#8696A0;padding:0 4px;margin-bottom:4px">
        💬 시나리오를 선택하거나 직접 주제를 입력하세요
      </div>
      ${scenarios.map(s => `
        <div class="scenario-card" data-scenario="${s.number}" onclick="selectScenario(${s.number})"
          style="background:white;border:2px solid #e5e5e5;border-radius:14px;padding:14px 16px;cursor:pointer;transition:all 0.2s;-webkit-tap-highlight-color:transparent">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="background:#667eea;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${s.number}</span>
            <div style="flex:1">
              <div style="font-weight:600;font-size:15px;color:#1a1a1a;margin-bottom:3px">${s.title}</div>
              <div style="font-size:12px;color:#8696A0">${(s.vocab_preview || []).join(', ')}</div>
            </div>
            <span style="color:#8696A0;font-size:18px">›</span>
          </div>
        </div>
      `).join('')}
      <div style="text-align:center;font-size:12px;color:#8696A0;padding:4px">또는 직접 주제 입력 가능</div>
    `;

    elements.conversation.appendChild(container);
    container.scrollIntoView({ behavior: 'smooth' });
    STATE.scenarioDetectionActive = true;

  } catch (e) {
    loaderEl.remove();
    console.error('showScenarioChoice error:', e);
  }
}

function activateScenarioDetection() {
  STATE.scenarioDetectionActive = true;
}

function selectScenario(number) {
  const scenario = STATE.currentScenarios?.find(s => s.number === number);
  if (!scenario) return;

  STATE.scenarioDetectionActive = false;
  document.getElementById('scenarioChoice')?.remove();

  showScenarioLoadingAnimation(scenario);
  STATE.selectedScenario = scenario;
  MissionMgr.selectedScenario = scenario;

  setTimeout(() => showMissionCard(scenario), 1200);
}

function showScenarioLoadingAnimation(scenario) {
  const loader = document.createElement('div');
  loader.id = 'missionCardLoader';
  loader.style.cssText = `
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 16px;
    padding: 20px;
    margin: 12px 0;
    color: white;
    text-align: center;
  `;
  loader.innerHTML = `
    <div style="font-size:20px;margin-bottom:8px">🎯</div>
    <div style="font-weight:700;font-size:15px;margin-bottom:4px">"${scenario.title}" 선택됨</div>
    <div style="font-size:12px;opacity:0.8;margin-bottom:16px">미션 카드 준비 중...</div>
    <div class="mission-card-progress"><div class="mission-card-progress-bar"></div></div>
  `;
  elements.conversation.appendChild(loader);
  loader.scrollIntoView({ behavior: 'smooth' });
}

function showMissionCard(scenario) {
  document.getElementById('missionCardLoader')?.remove();

  const grammarChips = (MissionMgr.override?.target_grammar || []).slice(0, 2)
    .map(g => `<span style="display:inline-block;background:#f0f3ff;color:#667eea;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600;margin:2px">${g}</span>`)
    .join('');
  const vocabChips = (MissionMgr.override?.vocabulary || []).slice(0, 3)
    .map(v => `<span style="display:inline-block;background:#f0fff4;color:#00a884;border-radius:8px;padding:4px 10px;font-size:12px;margin:2px">${v}</span>`)
    .join('');

  const card = document.createElement('div');
  card.className = 'mission-card';
  card.style.cssText = `
    background: white;
    border: 2px solid #667eea;
    border-radius: 16px;
    padding: 20px;
    margin: 12px 0;
    box-shadow: 0 4px 20px rgba(102,126,234,0.15);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f0f0f0">
      <span style="background:#667eea;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${scenario.number}</span>
      <div>
        <div style="font-weight:700;font-size:16px;color:#1a1a1a">${scenario.title}</div>
        <div style="font-size:11px;color:#8696A0">Mission Card</div>
      </div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:#667eea;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.5px">🎯 필수 도구</div>
      ${grammarChips}${vocabChips}
    </div>
    <div style="background:#fffbf0;border-left:3px solid #f7931e;border-radius:8px;padding:12px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:#f7931e;text-transform:uppercase;margin-bottom:8px">💡 Golden Thread (선택사항)</div>
      ${(scenario.golden_thread || []).map((step, i) =>
        `<div style="font-size:12px;color:#1a1a1a;margin-bottom:${i < 2 ? '6px' : '0'};display:flex;gap:8px">
          <span style="color:#f7931e;flex-shrink:0">→</span><span>${step}</span>
        </div>`
      ).join('')}
    </div>
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#8696A0;text-transform:uppercase;margin-bottom:6px">✨ 고급 연어 (Collocations)</div>
      ${(scenario.collocations || []).map(c =>
        `<span style="display:inline-block;background:#f8f8f8;border:1px solid #e5e5e5;border-radius:8px;padding:4px 10px;font-size:12px;margin:2px;color:#1a1a1a">${c}</span>`
      ).join('')}
    </div>
    <div style="background:#f0f3ff;border-radius:10px;padding:12px;font-size:14px;color:#1a1a1a;line-height:1.5">
      <div style="font-size:10px;color:#667eea;font-weight:700;margin-bottom:4px">KoCo:</div>
      ${scenario.first_question}
    </div>
  `;

  elements.conversation.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth' });

  setTimeout(() => injectMissionFirstQuestion(scenario), 600);
}

function injectMissionFirstQuestion(scenario) {
  addMessage('assistant', scenario.first_question);
  if (!AudioGate.isMuted()) speakKorean(scenario.first_question);
}

async function toggleMissionMode() {
  if (STATE.mode === 'mission') {
    updateMode('freeChat');
    elements.navTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === 'freeChat'));
    return;
  }

  const btn = document.getElementById('btnMission');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    const missionSheet = await generateMissionConstraints(STATE.unitId);

    updateMode('mission');
    elements.navTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === 'mission'));

    MissionMgr.override = {
      ...missionSheet.base_config,
      target_grammar: missionSheet.grammar,
      vocabulary: missionSheet.vocabulary,
      weak_points: missionSheet.weak_points,
      mission_sheet: true
    };

    showMissionSheet(missionSheet);
    showScenarioChoice(missionSheet);

  } catch (e) {
    console.error('generateMissionConstraints error:', e);
    updateMode('mission');
    elements.navTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === 'mission'));
    const cfg = window.resolveMissionConfig ? window.resolveMissionConfig(STATE.unitId) : null;
    showMissionBriefing(cfg);
  } finally {
    if (btn) { btn.textContent = '🎯 Examen'; btn.disabled = false; }
  }
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

  // Session Report (Speak mode)
  if (STATE.mode === 'speak' || STATE.mode === 'freeChat') {
    showSessionReport(corrections, STATE.session.goldenSentence || null);
  }

  elements.sessionSummaryModal.classList.remove('hidden');
}

function showSessionReport(corrections, goldenSentence) {
  const total = corrections?.length || 0;
  const correct = corrections?.filter(c => c.status === 'correct').length || 0;
  const mastery = total > 0 ? Math.round((correct / total) * 100) : 0;

  const majorCorrection = (corrections || [])
    .filter(c => c.status === 'major')
    .sort((a, b) => (b.fixed?.length || 0) - (a.original?.length || 0))[0];

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (mastery / 100) * circumference;

  const container = document.createElement('div');
  container.className = 'session-report-dashboard';
  container.innerHTML = `
    <div class="report-mastery">
      <svg width="100" height="100" style="transform:rotate(-90deg)">
        <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#f0f0f0" stroke-width="8"/>
        <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#667eea" stroke-width="8"
          stroke-dasharray="${circumference.toFixed(1)}"
          stroke-dashoffset="${offset.toFixed(1)}"
          stroke-linecap="round"
          style="transition:stroke-dashoffset 1s ease"/>
      </svg>
      <div class="report-mastery-score">
        <span class="report-mastery-pct">${mastery}%</span>
        <span class="report-mastery-label">Mastery</span>
      </div>
    </div>

    ${goldenSentence?.sentence ? `
    <div class="report-golden-card">
      <div class="report-golden-header">⭐ Golden Sentence</div>
      <div class="report-golden-sentence">"${goldenSentence.sentence}"</div>
      ${goldenSentence.why ? `<div class="report-golden-why">${goldenSentence.why}</div>` : ''}
      ${goldenSentence.structures_detected ? `<div class="report-golden-tag">${goldenSentence.structures_detected}</div>` : ''}
    </div>` : ''}

    ${majorCorrection ? `
    <div class="report-before-after">
      <div class="report-ba-header">🔄 Most Significant Correction</div>
      <div class="report-ba-grid">
        <div class="report-ba-before">
          <div class="report-ba-label">Before</div>
          <div class="report-ba-text error">${majorCorrection.original}</div>
        </div>
        <div class="report-ba-arrow">→</div>
        <div class="report-ba-after">
          <div class="report-ba-label">After</div>
          <div class="report-ba-text correct">${majorCorrection.fixed}</div>
        </div>
      </div>
      ${majorCorrection.note ? `<div class="report-ba-note">${majorCorrection.note}</div>` : ''}
    </div>` : ''}

    <div class="report-stats">
      <div class="report-stat">
        <span class="report-stat-value">${correct}</span>
        <span class="report-stat-label">Correct</span>
      </div>
      <div class="report-stat">
        <span class="report-stat-value">${sessionTargetsUsed.size}</span>
        <span class="report-stat-label">Targets Used</span>
      </div>
      <div class="report-stat">
        <span class="report-stat-value">${total}</span>
        <span class="report-stat-label">Total</span>
      </div>
    </div>

    <div class="report-actions">
      <button onclick="exportAnkiData()" class="report-btn-secondary">📤 Anki</button>
      <button onclick="startNewSession()" class="report-btn-primary">새 세션 →</button>
    </div>
  `;

  const summarySheet = document.querySelector('.summary-sheet');
  if (summarySheet) summarySheet.appendChild(container);
  resetSessionState();
}

function startNewSession() {
  closeSessionSummary();
  resetSession();
}

function exportAnkiData() {
  const ankiItems = STATE.sessionCorrections.filter(c => c.anki_ready);
  if (!ankiItems.length) {
    alert('이 세션에는 Anki 데이터가 없습니다.');
    return;
  }
  const tsv = ankiItems.map(c => `"${c.original}"\t"${c.fixed}"\t"${c.note}"`).join('\n');
  const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `koco_anki_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('Anki export:', ankiItems.length, 'cards');
}
window.exportAnkiData = exportAnkiData;

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
  STATE.session.goldenSentence = null;
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

function showOCRWarning(score) {
  const warn = document.createElement('div');
  warn.style.cssText = `
    background: rgba(229,57,53,0.08);
    border-left: 4px solid #e53935;
    border-radius: 8px;
    padding: 10px 14px;
    margin: 8px 12px;
    font-size: 13px;
    color: #e53935;
    font-weight: 600;
  `;
  warn.textContent = `⚠️ Qualité OCR faible (${score}/10) — vérifie la clarté de ta photo.`;
  elements.conversation?.appendChild(warn);
}

async function generateSNUMission() {
  if (!STATE.unitId || !window.kocoUserId) return;

  const loader = document.createElement('div');
  loader.id = 'missionLoader';
  loader.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    color: white; padding: 16px; border-radius: 12px;
    margin: 8px 0; text-align: center; font-size: 13px;
  `;
  loader.innerHTML = `
    <div>🎓 SNU Graduate Engine 가동 중...</div>
    <div style="font-size:11px;opacity:0.7;margin-top:4px">${STATE.unitId} 데이터 분석 중</div>
  `;
  elements.conversation.appendChild(loader);
  loader.scrollIntoView({ behavior: 'smooth' });

  const endpoint = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://localhost:3000/api/generate-mission'
    : '/api/generate-mission';

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId: STATE.unitId, userId: window.kocoUserId })
    });
    const { mission, error } = await resp.json();
    loader.remove();
    if (error) { showModeNotification('❌', '미션 생성 실패', error); return; }
    showSNUMissionCard(mission);
  } catch (e) {
    loader.remove();
    console.error('generateSNUMission error:', e);
    showAlert('error', '❌ Mission generation failed');
  }
}

function showSNUMissionCard(mission) {
  const card = document.createElement('div');
  card.className = 'snu-mission-card';

  card.innerHTML = `
    <div class="snu-mission-label">🎓 SNU GRADUATE MISSION</div>
    <div class="snu-mission-title">${mission.title}</div>
    <div class="snu-mission-context">${mission.academic_context}</div>
    <div class="snu-mission-section">
      <div class="snu-section-label">형식 선택</div>
      <div class="snu-format-btns">
        ${mission.format_options.map(f => `
          <button class="snu-format-btn" onclick="selectMissionFormat(this,'${f}')">${f}</button>
        `).join('')}
      </div>
    </div>
    <div class="snu-mission-requirements">
      <div class="snu-req-label">필수 포함 요소</div>
      <div class="snu-req-row">
        <span class="snu-req-type">문법:</span>
        ${mission.requirements.grammar.map(g => `<span class="snu-chip snu-chip--grammar">${g}</span>`).join('')}
      </div>
      <div class="snu-req-row">
        <span class="snu-req-type">어휘:</span>
        ${mission.requirements.vocabulary.map(v => `<span class="snu-chip snu-chip--vocab">${v}</span>`).join('')}
      </div>
    </div>
    <div class="snu-mission-instructions">${mission.instructions}</div>
    ${mission.evaluation_criteria ? `<div class="snu-mission-eval"><strong>평가 기준:</strong> ${mission.evaluation_criteria}</div>` : ''}
    <div class="snu-mission-help">💡 ${mission.help_command}</div>
    <button class="snu-start-btn" onclick="startSNUMission()">미션 시작 →</button>
  `;

  elements.conversation.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth' });
  STATE.currentSNUMission = mission;
}

function selectMissionFormat(btn, format) {
  btn.closest('.snu-format-btns').querySelectorAll('.snu-format-btn').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  STATE.selectedMissionFormat = format;
}

function startSNUMission() {
  if (!STATE.currentSNUMission) return;
  const format = STATE.selectedMissionFormat || STATE.currentSNUMission.format_options[0];

  STATE.mode = 'mission';
  document.getElementById('btnMission')?.classList.add('active');
  document.getElementById('btnSpeak')?.classList.remove('active');
  document.getElementById('btnDailyLife')?.classList.remove('active');

  MissionMgr.activate(STATE.unitId);
  MissionMgr.override = {
    ...(MissionMgr.override || {}),
    target_grammar: STATE.currentSNUMission.requirements.grammar,
    vocabulary: STATE.currentSNUMission.requirements.vocabulary,
    mission_brief: `${format} 형식으로 작성하세요.`,
    difficulty_level: '5B',
    severity: 'academic',
    tolerance: 'zero',
    forbidden_patterns: ['그리고', '그래서', '그냥', '좀'],
    min_clauses: 3
  };

  const startMsg = `미션을 시작합니다. 형식: ${format}
필수 구조: ${STATE.currentSNUMission.requirements.grammar.join(', ')}
필수 어휘: ${STATE.currentSNUMission.requirements.vocabulary.join(', ')}
시작하세요 →`;

  addMessage('assistant', startMsg);
  if (!AudioGate.isMuted()) speakKorean(startMsg);
}

// ── Knowledge Snapshot ─────────────────────────────────────────────────────

async function fetchKnowledgeSnapshot() {
  const snapshotEndpoint = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://localhost:3000/api/knowledge-snapshot'
    : '/api/knowledge-snapshot';

  const btn = document.getElementById('snapshotBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 분석 중...'; }

  try {
    const resp = await fetch(snapshotEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.kocoUserId })
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const { snapshot } = await resp.json();
    STATE.knowledgeSnapshot = snapshot;
    renderKnowledgeSnapshot(snapshot);
  } catch (e) {
    console.error('fetchKnowledgeSnapshot error:', e);
    const container = document.getElementById('snapshotContainer');
    if (container) container.innerHTML = '<p class="stats-empty">스냅샷을 불러오지 못했습니다.</p>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🧠 Knowledge Snapshot'; }
  }
}

function renderKnowledgeSnapshot(snapshot) {
  const container = document.getElementById('snapshotContainer');
  if (!container) return;

  const { units = [], painPoints = [], topErrors = [] } = snapshot;

  const masteryBars = units.length === 0
    ? '<p class="stats-empty">아직 업로드된 단원이 없어요.</p>'
    : units.map(u => {
        const pct = Math.min(100, u.mastery);
        const color = pct < 30 ? '#e53935' : pct < 60 ? '#f7931e' : '#00a884';
        return `<div class="ks-unit">
          <div class="ks-unit-label">${u.theme || u.unit_id} <span class="ks-unit-meta">${u.vocab_count}어 · ${u.structure_count}구조 · ${u.session_count}세션</span></div>
          <div class="ks-bar-track"><div class="ks-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>`;
      }).join('');

  const painHTML = painPoints.length === 0
    ? '<p class="stats-empty">교정 항목 없음</p>'
    : painPoints.map(p => `
        <div class="ks-pain-item" onclick="activateRecallMode(${JSON.stringify(JSON.stringify(p))})">
          <span class="ks-pain-original">${p.original}</span>
          <span class="ks-pain-arrow">→</span>
          <span class="ks-pain-fixed">${p.fixed}</span>
          <span class="ks-pain-note">${p.note || ''}</span>
        </div>`).join('');

  const errorHTML = topErrors.length === 0 ? ''
    : `<div class="ks-section">
        <h4 class="ks-section-title">🔁 반복 오류 패턴</h4>
        ${topErrors.map(e => `<div class="ks-error-tag">${e.note} <span class="ks-error-count">×${e.count}</span></div>`).join('')}
       </div>`;

  container.innerHTML = `
    <div class="ks-card">
      <div class="ks-section">
        <h4 class="ks-section-title">📚 단원별 숙달도</h4>
        ${masteryBars}
      </div>
      <div class="ks-section">
        <h4 class="ks-section-title">⚠️ 취약점 (탭하면 드릴 시작)</h4>
        ${painHTML}
      </div>
      ${errorHTML}
      <p class="ks-timestamp">생성: ${new Date(snapshot.generatedAt).toLocaleString('ko-KR')}</p>
    </div>`;
}

function activateRecallMode(jsonStr) {
  let painPoint;
  try { painPoint = JSON.parse(jsonStr); } catch { return; }

  STATE.knowledgeSnapshot = STATE.knowledgeSnapshot || {};
  STATE.knowledgeSnapshot.activeDrill = painPoint;

  updateMode('freeChat');
  const navTab = Array.from(document.querySelectorAll('.nav-tab')).find(t => t.dataset.mode === 'freeChat');
  if (navTab) navTab.click();

  const drillMsg = `📌 취약점 드릴 시작\n오류: ${painPoint.original}\n교정: ${painPoint.fixed}\n${painPoint.note ? `힌트: ${painPoint.note}\n` : ''}이 표현을 사용해서 문장을 만들어 보세요!`;
  addMessage('assistant', drillMsg);
}

// ─────────────────────────────────────────────────────────────────────────────

async function mergeOcrContent(unitId, newCtx) {
  const existing = window.getLessonContent ? await window.getLessonContent(unitId) : null;
  if (!existing) return newCtx;

  const fp = str => (str || '').slice(0, 50);

  const mergedVocab = [...(existing.vocabulary || [])];
  for (const item of (newCtx.vocabulary || [])) {
    if (!mergedVocab.some(v => fp(v) === fp(item))) mergedVocab.push(item);
  }

  const mergedStructures = [...(existing.structures || [])];
  for (const item of (newCtx.structures || [])) {
    if (!mergedStructures.some(s => fp(s) === fp(item))) mergedStructures.push(item);
  }

  const existingTheme = existing.theme || '';
  const newTheme = newCtx.theme || '';
  const theme = existingTheme && newTheme && !existingTheme.includes(newTheme.slice(0, 50))
    ? `${existingTheme} ${newTheme}`
    : existingTheme || newTheme;

  const mergedStarters = [...(existing.conversation_starters || [])];
  for (const item of (newCtx.conversation_starters || [])) {
    if (!mergedStarters.some(s => fp(s) === fp(item))) mergedStarters.push(item);
  }

  const mergedSnippets = [...(existing.context_snippets || [])];
  for (const item of (newCtx.context_snippets || [])) {
    if (!mergedSnippets.some(s => fp(s) === fp(item))) mergedSnippets.push(item);
  }

  return {
    vocabulary: mergedVocab,
    structures: mergedStructures,
    theme,
    level: newCtx.level || existing.level || '',
    conversation_starters: mergedStarters,
    context_snippets: mergedSnippets,
    category: newCtx.category || existing.category || '',
    ocr_confidence: newCtx.ocr_confidence ?? existing.ocr_confidence ?? 0.5
  };
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
          body: JSON.stringify({ imageBase64: base64, unitId: targetUnitId })
        });
        if (!resp.ok) throw new Error('analyze-image failed');
        const ctx = await resp.json();

        // OCR confidence check (0.0–1.0 scale)
        const confidence = ctx.ocr_confidence ?? 0.5;
        if (confidence < 0.5) {
          showOCRWarning(Math.round(confidence * 100));
        }

        // Merge with existing content (append, no duplicates)
        const merged = await mergeOcrContent(targetUnitId, ctx);

        // Save merged content to Supabase
        if (window.saveLessonContent) {
          await window.saveLessonContent(targetUnitId, merged);
        }

        // If for current unit, update pageContext
        if (targetUnitId === STATE.unitId) {
          STATE.pageContext = merged;
          bootstrapMissionFromImage(merged);
        }

        // Refresh health after OCR
        if (window.invalidateHealthCache) window.invalidateHealthCache(targetUnitId);
        if (window.getDataHealth) {
          window.getDataHealth(targetUnitId).then(health => {
            const dot = document.getElementById(`health-dot-${targetUnitId}`);
            if (dot) {
              dot.style.background = health.color;
              dot.classList.remove('loading');
              dot.title = `${health.label} — ${health.wordCount} mots estimés`;
              dot.style.transform = 'scale(1.5)';
              setTimeout(() => { dot.style.transform = 'scale(1)'; }, 300);
            }
            if (targetUnitId === STATE.unitId) updateContextGuard(targetUnitId);
          });
        }

        // Update photo button in modal if still open
        const photoBtn = document.querySelector(`.unit-selector-item__photo[data-unit-id="${targetUnitId}"]`);
        if (photoBtn) photoBtn.classList.add('has-content');

        // Enriched notification
        const vocab = (ctx.vocabulary || []).length;
        const structs = (ctx.structures || []).length;
        const snippets = (ctx.context_snippets || []).length;
        const confidencePct = Math.round(confidence * 100);
        const category = ctx.category || '';
        const lowQuality = confidence < 0.5;

        const msg = lowQuality
          ? `⚠️ Qualité faible (${confidencePct}%) — retake la photo pour de meilleurs résultats`
          : `✅ ${vocab} mots · ${structs} structures · ${snippets} exemples · confiance: ${confidencePct}%${category ? ` [${category}]` : ''}`;

        if (indicator) {
          indicator.textContent = msg;
          if (!lowQuality) indicator.classList.add('message--system-ok');
        } else {
          showAlert(lowQuality ? 'error' : 'success', msg);
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

  // ÉTAPE 5 — Scenario detection before sending to Claude
  if (STATE.scenarioDetectionActive) {
    const num = parseInt(text);
    if ([1, 2, 3].includes(num) && text === String(num)) {
      textarea.value = '';
      textarea.style.height = 'auto';
      syncMicSendState();
      selectScenario(num);
      return;
    }
    const flexMatch = text.match(/([123])/);
    if (flexMatch) {
      const detected = parseInt(flexMatch[1]);
      if ([1, 2, 3].includes(detected)) {
        textarea.value = '';
        textarea.style.height = 'auto';
        syncMicSendState();
        selectScenario(detected);
        return;
      }
    }
    STATE.scenarioDetectionActive = false;
  }

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

  const ttsGhost = document.getElementById('ttsToggle');
  if (ttsGhost) ttsGhost.addEventListener('click', toggleTTS);
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
        updateContextGuard(STATE.unitId);
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
