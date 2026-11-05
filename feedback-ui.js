// feedback-ui.js — P3 : affichage du feedback en escalier, barre des cibles,
// correction de transcription, répétition à voix haute, latence, rapport de session.
// Dépend de : feedback-ladder.js (window.FeedbackLadder) et, à l'appel, des
// fonctions globales d'app.js (STATE, elements, startRecording, stopRecording, processUserInput).

(function () {
  'use strict';

  const LADDER_MODES = ['mission', 'speak'];
  const MODE_KEY = 'koco_feedback_mode';
  const MODE_LABELS = { discret: 'Discret', normal: 'Normal', strict: 'Strict' };

  // ── Utilitaires ─────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function getMode() {
    try { const m = localStorage.getItem(MODE_KEY); if (m && window.FeedbackLadder.MODES.includes(m)) return m; } catch (e) { /* stockage indisponible */ }
    return 'normal';
  }
  function setMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* ignore */ } }

  /** Diff mot à mot : mots retirés barrés, mots ajoutés en vert. */
  function wordDiff(original, fixed) {
    const a = String(original || '').split(/\s+/).filter(Boolean);
    const b = String(fixed || '').split(/\s+/).filter(Boolean);
    const m = a.length, n = b.length;
    const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) { out.push(esc(a[i])); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { out.push(`<del class="fl-del">${esc(a[i])}</del>`); i++; }
      else { out.push(`<ins class="fl-ins">${esc(b[j])}</ins>`); j++; }
    }
    while (i < m) out.push(`<del class="fl-del">${esc(a[i++])}</del>`);
    while (j < n) out.push(`<ins class="fl-ins">${esc(b[j++])}</ins>`);
    return out.join(' ');
  }

  function append(el) {
    elements.conversation.appendChild(el);
    elements.conversation.scrollTop = elements.conversation.scrollHeight;
  }

  // ── Cycle de vie de l'escalier ──────────────────────────────────────────────
  function ensureLadder(context) {
    if (!LADDER_MODES.includes(STATE.mode)) return null;
    const cfg = context.missionOverride
      || (window.resolveMissionConfig ? window.resolveMissionConfig(context.unitId) : null) || {};
    const targets = (cfg.target_grammar || []).filter(Boolean).slice(0, window.FeedbackLadder.MAX_TARGETS);
    if (!targets.length) return null;
    const key = [STATE.mode, context.unitId, getMode(), targets.join('|')].join('::');
    if (STATE.ladderKey !== key || !STATE.ladder) {
      STATE.ladder = window.FeedbackLadder.create({ targets, mode: getMode() });
      STATE.ladderKey = key;
      STATE.ladderMetrics = { latencies: [], transcriptEdits: 0, repeats: [] };
      renderTargetBar();
    }
    return STATE.ladder;
  }

  function resetLadder() {
    STATE.ladder = null;
    STATE.ladderKey = null;
    STATE.ladderMetrics = null;
    document.getElementById('flBar')?.remove();
  }

  // ── Barre des cibles (en haut du chat) ──────────────────────────────────────
  function renderTargetBar() {
    const ladder = STATE.ladder;
    let bar = document.getElementById('flBar');
    if (!ladder) { bar?.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'flBar';
      bar.className = 'fl-bar';
      elements.conversation.prepend(bar);
    }
    const stats = ladder.report().targets;
    const pills = stats.map(s => {
      const rung = ladder.rungOf(s.structure);
      const state = rung === 1 ? 'pending' : s.used > 0 ? 'used' : 'idle';
      const icon = state === 'pending' ? '🤔' : state === 'used' ? '✓' : '○';
      return `<span class="fl-pill fl-pill--${state}" title="utilisée ${s.used}× · autocorrigée ${s.selfRepaired}× · corrigée ${s.explicit}×">${icon} ${esc(s.structure)}</span>`;
    }).join('');
    bar.innerHTML = `
      <span class="fl-bar__label">Cibles</span>
      <div class="fl-bar__pills">${pills}</div>
      <label class="fl-bar__mode">Correction
        <select id="flModeSelect">${Object.entries(MODE_LABELS).map(([k, v]) =>
          `<option value="${k}" ${k === ladder.mode ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>`;
    bar.querySelector('#flModeSelect').addEventListener('change', (e) => {
      setMode(e.target.value);
      STATE.ladderKey = null; // recréé au prochain tour avec le nouveau mode
      window.showToast && window.showToast(`Mode de correction : ${MODE_LABELS[e.target.value]} (au prochain message)`);
    });
  }

  // ── Affichage d'une décision ────────────────────────────────────────────────
  function renderDecision(decision) {
    if (!decision) return;
    const c = decision.correction || {};
    const el = document.createElement('div');
    el.className = `fl-fb fl-fb--${decision.display}`;

    switch (decision.display) {
      case 'correct':
        el.textContent = '✅ 자연스러워요!';
        break;
      case 'self_repaired':
        el.innerHTML = `✅ <strong>Corrigé par toi-même</strong>${decision.target ? ` · ${esc(decision.target)}` : ''}`;
        break;
      case 'prompt':
        el.innerHTML = `🤔 <strong>Essaie de te corriger</strong>${decision.target ? ` <span class="fl-chip">${esc(decision.target)}</span>` : ''}`;
        break;
      case 'recast':
        el.innerHTML = `<details><summary>reformulation</summary><div class="fl-diff">${wordDiff(c.original, c.fixed)}</div>${c.note ? `<div class="fl-note">${esc(c.note)}</div>` : ''}</details>`;
        break;
      case 'verify':
        el.innerHTML = `⚠️ <strong>À vérifier</strong> — KoCo n'est pas sûr : <span class="fl-diff">${wordDiff(c.original, c.fixed)}</span>${c.note ? `<div class="fl-note">${esc(c.note)}</div>` : ''}`;
        break;
      case 'stt':
        el.innerHTML = `🎙 Je n'ai peut-être pas bien entendu. Si la transcription est fausse, touche ✏️ sur ton message.`;
        highlightLastEdit();
        break;
      case 'explicit':
        el.innerHTML = `
          <div class="fl-rule__head">Règle${decision.target ? ` · ${esc(decision.target)}` : ''}</div>
          <div class="fl-diff fl-diff--big">${wordDiff(c.original, c.fixed)}</div>
          ${c.note ? `<div class="fl-note">${esc(c.note)}</div>` : ''}
          <div class="fl-rule__actions">
            <button type="button" class="fl-btn fl-repeat">🎙 Répéter à voix haute</button>
            <span class="fl-repeat-result" aria-live="polite"></span>
          </div>`;
        wireRepeat(el);
        break;
      default:
        return;
    }
    append(el);
    renderTargetBar();
  }

  // ── Répétition à voix haute après une correction explicite ──────────────────
  function wireRepeat(el) {
    const btn = el.querySelector('.fl-repeat');
    const out = el.querySelector('.fl-repeat-result');
    let recording = false;
    btn.addEventListener('click', async () => {
      if (!STATE.ladder?.pendingRepeat && !recording) { out.textContent = 'Déjà fait ✓'; btn.disabled = true; return; }
      if (!recording) {
        await startRecording();
        recording = true;
        btn.textContent = '⏹ Terminer';
        return;
      }
      recording = false;
      btn.textContent = '🎙 Répéter à voix haute';
      const said = await stopRecording();
      const r = STATE.ladder.checkRepeat(said || '');
      STATE.ladderMetrics?.repeats.push({ ok: r.ok, tries: r.tries });
      if (r.ok) { out.textContent = '✓ Bien dit'; btn.disabled = true; }
      else if (r.done) { out.textContent = `On le reverra demain dans le rappel oral. (entendu : « ${said || '…'} »)`; btn.disabled = true; }
      else { out.textContent = `Encore une fois ? (entendu : « ${said || '…'} »)`; }
    });
  }

  // ── Correction de la transcription vocale ───────────────────────────────────
  function attachEdit(wrapper, text) {
    if (!wrapper) return;
    const bubble = wrapper.querySelector('.message__bubble') || wrapper;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fl-edit';
    btn.title = 'Corriger ma transcription';
    btn.setAttribute('aria-label', 'Corriger ma transcription');
    btn.textContent = '✏️';
    bubble.appendChild(btn);
    btn.addEventListener('click', () => {
      if (wrapper.querySelector('.fl-edit-form')) return;
      const form = document.createElement('form');
      form.className = 'fl-edit-form';
      form.innerHTML = `<input type="text" class="fl-edit-input" aria-label="Ce que j'ai vraiment dit"><button type="submit" class="fl-btn">Renvoyer</button>`;
      const input = form.querySelector('input');
      input.value = text;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fixed = input.value.trim();
        if (!fixed || fixed === text) { form.remove(); return; }
        // La décision prise sur la mauvaise transcription est annulée
        STATE.ladder?.undoLast();
        if (STATE.ladderMetrics) STATE.ladderMetrics.transcriptEdits += 1;
        form.remove();
        btn.remove();
        bubble.classList.add('fl-edited');
        processUserInput(`(Transcription corrigée — j'ai dit en réalité :) ${fixed}`);
      });
      wrapper.appendChild(form);
      input.focus();
    });
  }

  function highlightLastEdit() {
    const all = elements.conversation.querySelectorAll('.fl-edit');
    const last = all[all.length - 1];
    if (last) last.classList.add('fl-edit--hint');
  }

  // ── Latence : fin de la voix de KoCo → début de l'enregistrement ────────────
  let lastTtsEnd = 0;
  function markTtsEnd() { lastTtsEnd = performance.now(); }
  function markRecordStart() {
    if (!lastTtsEnd || !STATE.ladderMetrics) return;
    const ms = Math.round(performance.now() - lastTtsEnd);
    lastTtsEnd = 0;
    if (ms > 0 && ms < 60000) STATE.ladderMetrics.latencies.push(ms);
  }

  // ── Rapport de fin de session ───────────────────────────────────────────────
  function median(xs) {
    if (!xs.length) return null;
    const s = xs.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  }

  function summaryHtml() {
    const ladder = STATE.ladder;
    if (!ladder) return '';
    const r = ladder.report();
    const rows = r.targets.map(t => `
      <tr><td>${esc(t.structure)}</td><td>${t.used}</td><td>${t.selfRepaired}</td><td>${t.explicit}</td></tr>`).join('');
    const work = r.explicit.slice(-3).map(e =>
      `<li><span class="fl-diff">${wordDiff(e.original, e.fixed)}</span></li>`).join('');
    const lat = median(STATE.ladderMetrics?.latencies || []);
    return `
      <div class="fl-summary">
        <div class="fl-summary__title">Tes structures cibles</div>
        <table class="fl-table"><thead><tr><th>Structure</th><th>Utilisée</th><th>Autocorrigée</th><th>Corrigée</th></tr></thead><tbody>${rows}</tbody></table>
        ${work ? `<div class="fl-summary__title">À retravailler (reviendra dans le rappel oral)</div><ul class="fl-list">${work}</ul>` : ''}
        ${lat ? `<div class="fl-summary__meta">Temps de réaction médian : ${(lat / 1000).toFixed(1)} s</div>` : ''}
      </div>`;
  }

  async function saveMetrics() {
    const ladder = STATE.ladder;
    if (!ladder || !window.supabaseClient) return;
    const r = ladder.report();
    if (!Object.keys(r.counts).length) return;
    const m = STATE.ladderMetrics || {};
    const { error } = await window.supabaseClient.from('session_metrics').insert({
      user_id: window.kocoUserId,
      unit_id: STATE.unitId || '',
      total_messages: STATE.messageCount || 0,
      total_words: STATE.session?.totalUserWords || 0,
      target_grammar_used: r.targets,
      mlu_detail: {
        kind: 'p3_feedback_ladder',
        mode: STATE.mode,
        feedback_mode: r.mode,
        counts: r.counts,
        latency_median_ms: median(m.latencies || []),
        latencies_ms: (m.latencies || []).slice(0, 100),
        transcript_edits: m.transcriptEdits || 0,
        repeats: m.repeats || [],
      },
      created_at: new Date().toISOString(),
    });
    if (error) console.error('[P3] saveMetrics error:', JSON.stringify(error));
  }

  window.kocoFeedback = {
    LADDER_MODES, ensureLadder, resetLadder, renderDecision, attachEdit,
    markTtsEnd, markRecordStart, summaryHtml, saveMetrics, wordDiff,
  };
})();
