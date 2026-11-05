// feedback-ladder.js — P3 : feedback en escalier (voir docs/P3-feedback-escalier.md)
// Machine à états pure : aucune dépendance au DOM, testable avec `node scripts/test-feedback-ladder.js`.
//
// Pour chaque structure cible, un échelon :
//   0 = aucune erreur en cours
//   1 = une relance (incitation à se corriger) a été donnée
// Une 2ᵉ erreur sur la même cible → correction explicite, puis retour à 0.

(function (root) {
  'use strict';

  const MODES = ['discret', 'normal', 'strict'];
  const MAX_TARGETS = 3;

  function norm(s) {
    return String(s || '')
      .normalize('NFC')
      .replace(/[\s.,!?~…'"“”‘’()\[\]-]/g, '')
      .toLowerCase();
  }

  // Distance de Levenshtein sur les syllabes (caractères) — suffisante pour le hangeul
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  /** Similarité 0..1 entre deux phrases, ponctuation et espaces ignorés. */
  function similarity(a, b) {
    const x = norm(a), y = norm(b);
    if (!x && !y) return 1;
    const d = levenshtein(x, y);
    return 1 - d / Math.max(x.length, y.length);
  }

  /** Mots de la forme corrigée absents de la phrase d'origine (= ce qui doit être répété). */
  function changedWords(original, fixed) {
    const before = new Set(String(original || '').split(/\s+/).map(norm).filter(Boolean));
    return String(fixed || '').split(/\s+/).map(norm).filter(w => w && !before.has(w));
  }

  /** Associe la cible déclarée par Claude à une cible de la session (tolère les variantes d'écriture). */
  function matchTarget(declared, targets) {
    if (!declared || /^none$/i.test(declared.trim())) return null;
    const d = norm(declared).replace(/^[-~]/, '');
    if (!d) return null;
    for (const t of targets) {
      const n = norm(t).replace(/^[-~]/, '');
      if (n && (n === d || n.includes(d) || d.includes(n))) return t;
    }
    return null;
  }

  function create(options) {
    const opts = options || {};
    const mode = MODES.includes(opts.mode) ? opts.mode : 'normal';
    const targets = (opts.targets || []).filter(Boolean).slice(0, MAX_TARGETS);

    const rung = {};
    const stats = {};
    targets.forEach(t => {
      rung[t] = 0;
      stats[t] = { used: 0, selfRepaired: 0, prompted: 0, explicit: 0 };
    });

    const events = [];
    let pendingRepeat = null; // { target, fixed, tries }

    function event(kind, data) {
      const e = Object.assign({ kind, at: Date.now() }, data);
      events.push(e);
      return e;
    }

    /**
     * Traite un bloc [CORRECTION] étendu.
     * Renvoie la décision d'affichage :
     *   { display: 'correct'|'self_repaired'|'prompt'|'explicit'|'recast'|'verify'|'stt'|'none',
     *     target, correction, save }
     * save = true → la correction doit être enregistrée (corrections / review_items).
     */
    function process(correction) {
      const c = correction || {};
      const status = (c.status || '').toLowerCase();
      const target = matchTarget(c.target, targets);
      const confidence = (c.confidence || 'high').toLowerCase();
      const sttSuspect = /^y/i.test(c.stt_suspect || '');

      if (sttSuspect) {
        return decide('stt', target, c, false);
      }

      if (status === 'correct' || !status) {
        if (target) {
          stats[target].used += 1;
          if (rung[target] > 0) {
            rung[target] = 0;
            stats[target].selfRepaired += 1;
            return decide('self_repaired', target, c, false);
          }
        }
        return decide(status ? 'correct' : 'none', target, c, false);
      }

      // À partir d'ici : erreur (minor | major)
      if (confidence === 'low') {
        return decide('verify', target, c, false);
      }

      if (mode === 'discret') {
        return decide('recast', target, c, false);
      }

      if (!target) {
        // Erreur hors cible : reformulation, sauf en mode strict pour une erreur majeure
        if (mode === 'strict' && status === 'major') return decide('explicit', null, c, true);
        return decide('recast', null, c, false);
      }

      if (rung[target] === 0) {
        rung[target] = 1;
        stats[target].prompted += 1;
        return decide('prompt', target, c, false);
      }

      // 2ᵉ erreur sur la même cible → correction explicite + répétition à voix haute
      rung[target] = 0;
      stats[target].explicit += 1;
      pendingRepeat = { target, fixed: c.fixed, keyWords: changedWords(c.original, c.fixed), tries: 0 };
      return decide('explicit', target, c, true);
    }

    function decide(display, target, correction, save) {
      event(display, { target, original: correction.original, fixed: correction.fixed });
      return { display, target, correction, save };
    }

    /**
     * Vérifie la répétition à voix haute après une correction explicite.
     * Renvoie { ok, tries, done } — done = plus d'essai demandé (2 max, jamais bloquant).
     */
    function checkRepeat(transcript) {
      if (!pendingRepeat) return { ok: false, tries: 0, done: true };
      pendingRepeat.tries += 1;
      const score = similarity(transcript, pendingRepeat.fixed);
      const said = norm(transcript);
      // Les mots corrigés doivent être présents (tolérance d'une syllabe pour les erreurs de STT)
      const keyOk = pendingRepeat.keyWords.every(w =>
        said.includes(w) || (w.length >= 3 && said.includes(w.slice(0, -1))));
      const ok = keyOk && score >= 0.7;
      const done = ok || pendingRepeat.tries >= 2;
      event('repeat', { target: pendingRepeat.target, ok, score: Math.round(score * 100) / 100 });
      const tries = pendingRepeat.tries;
      if (done) pendingRepeat = null;
      return { ok, tries, done, score };
    }

    /** Annule la dernière décision (transcription corrigée par l'utilisateur). */
    function undoLast() {
      const last = events.pop();
      if (!last) return;
      const t = last.target;
      if (!t || !stats[t]) return;
      if (last.kind === 'prompt') { rung[t] = 0; stats[t].prompted -= 1; }
      if (last.kind === 'explicit') { rung[t] = 1; stats[t].explicit -= 1; pendingRepeat = null; }
      if (last.kind === 'self_repaired') { rung[t] = 1; stats[t].selfRepaired -= 1; stats[t].used -= 1; }
      if (last.kind === 'correct') { stats[t].used -= 1; }
    }

    /** Bloc injecté dans le prompt système pour que Claude choisisse le bon type de feedback. */
    function promptState() {
      if (!targets.length) return '';
      const lines = targets.map(t => {
        if (mode === 'discret') return `• ${t} : mode discret → reformulation seulement`;
        return rung[t] === 1
          ? `• ${t} : échelon 1 (relance déjà donnée) → si nouvelle erreur : FEEDBACK: explicit`
          : `• ${t} : échelon 0 → si erreur : FEEDBACK: prompt (relance, NE PAS donner la forme correcte)`;
      });
      return lines.join('\n');
    }

    function report() {
      const counts = events.reduce((acc, e) => { acc[e.kind] = (acc[e.kind] || 0) + 1; return acc; }, {});
      return {
        mode,
        targets: targets.map(t => Object.assign({ structure: t }, stats[t])),
        counts,
        explicit: events.filter(e => e.kind === 'explicit'),
        recasts: events.filter(e => e.kind === 'recast'),
      };
    }

    return {
      mode, targets, process, checkRepeat, undoLast, promptState, report,
      get pendingRepeat() { return pendingRepeat; },
      get events() { return events.slice(); },
      rungOf: t => rung[t],
    };
  }

  const api = { create, similarity, matchTarget, MODES, MAX_TARGETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FeedbackLadder = api;
})(typeof window !== 'undefined' ? window : globalThis);
