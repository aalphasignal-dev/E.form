/* E.form — η φόρμα των συμμετεχόντων. */
(function () {
  'use strict';

  const { h, icon, clear, config, format, store } = window.EF;
  const S = config.survey;
  const QUESTIONS = config.questions;
  const DRAFT_KEY = 'eform.draft';
  const DRAFT_SIG = QUESTIONS.map((q) => q.id + ':' + q.type).join('|');
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const pad2 = (n) => String(n).padStart(2, '0');

  const ERRORS = {
    network: 'Δεν ήταν δυνατή η σύνδεση με τον διακομιστή. Ελέγξτε τη σύνδεσή σας στο internet και δοκιμάστε ξανά.',
    timeout: 'Ο διακομιστής αργεί να απαντήσει. Περιμένετε λίγο και δοκιμάστε ξανά.',
    rate_limited: 'Έρχονται πολλές απαντήσεις αυτή τη στιγμή. Δοκιμάστε ξανά σε ένα λεπτό.',
    busy: 'Ο διακομιστής είναι απασχολημένος. Δοκιμάστε ξανά σε λίγα δευτερόλεπτα.',
    too_large: 'Κάποια απάντηση είναι πολύ μεγάλη. Συντομεύστε την και δοκιμάστε ξανά.',
    empty: 'Δεν συμπληρώσατε καμία απάντηση.',
    not_configured: 'Η φόρμα δεν έχει συνδεθεί ακόμα με τον διακομιστή. Ενημερώστε τον διαχειριστή.',
    bad_response: 'Ο διακομιστής έδωσε μη αναμενόμενη απάντηση. Ενημερώστε τον διαχειριστή.',
    default: 'Κάτι πήγε στραβά και η απάντηση δεν στάλθηκε. Δοκιμάστε ξανά.'
  };

  const TYPE_LABELS = { choice: 'Επιλογή', multi: 'Πολλαπλή επιλογή', rating: 'Κλίμακα', text: 'Κείμενο', textarea: 'Κείμενο' };

  const els = {
    form: document.getElementById('survey'),
    fields: document.getElementById('survey-fields'),
    list: document.getElementById('questions'),
    submit: document.getElementById('submit-btn'),
    submitLabel: document.getElementById('submit-label'),
    status: document.getElementById('form-status'),
    honeypot: document.getElementById('hp-website'),
    success: document.getElementById('success'),
    again: document.getElementById('again-btn'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    configWarning: document.getElementById('config-warning')
  };

  const startedAt = Date.now();
  const minutes = Math.max(1, Math.round(QUESTIONS.length * 0.35));
  let submissionId = window.EF.uid();
  let sending = false;

  // ─── ΚΕΙΜΕΝΑ & ΤΑΥΤΟΤΗΤΑ ΑΠΟ ΤΟ CONFIG ─────────────────────────────────

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null && value !== '') el.textContent = String(value);
  }

  /** Μια «χειρόγραφη» γραμμή κάτω από τη λέξη-κλειδί του τίτλου. */
  function scribble() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'scribble');
    svg.setAttribute('viewBox', '0 0 200 12');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M3 8.6C38 3.6 77 3 113 5.4S171 10.6 197 4.2');
    path.setAttribute('pathLength', '1');
    svg.appendChild(path);
    return svg;
  }

  function paintTitle() {
    const title = document.getElementById('hero-title');
    const words = S.title.split(/\s+/).filter(Boolean);
    clear(title).setAttribute('aria-label', S.title);
    words.forEach((word, i) => {
      const inner = h('span', { text: word });
      inner.style.setProperty('--i', String(i));
      const mask = h('span', { class: 'w', 'aria-hidden': 'true' }, inner);
      const isAccent = words.length > 1 && i === words.length - 1;
      title.append(isAccent ? h('span', { class: 'accent' }, [mask, scribble()]) : mask);
      if (i < words.length - 1) title.append(' ');
    });
  }

  function paintBrand() {
    document.querySelectorAll('[data-brand-name]').forEach((el) => { el.textContent = S.brand; });
    if (S.logo) {
      const mark = document.querySelector('.brand-mark');
      if (mark) mark.replaceWith(h('img', { class: 'brand-logo', src: S.logo, alt: S.brand }));
      const name = document.getElementById('brand-name');
      if (name) name.classList.add('sr-only');
    }
    setText('footer-brand', '© ' + new Date().getFullYear() + ' ' + S.brand);
  }

  function paintCopy() {
    document.title = S.title + ' · ' + S.brand;
    paintBrand();
    paintTitle();
    setText('hero-eyebrow', S.eyebrow);
    setText('hero-subtitle', S.subtitle);
    setText('success-title', S.successTitle);
    setText('success-text', S.successText);
    els.submitLabel.textContent = S.submitLabel;
    setText('meta-count', QUESTIONS.length);
    setText('meta-time', '~' + minutes + ' λεπτ' + (minutes === 1 ? 'ό' : 'ά'));
    setText('meta-required', QUESTIONS.filter((q) => q.required).length);
  }

  // ─── 3D ΑΞΟΝΟΜΕΤΡΙΑ ΣΤΟ HERO (διακοσμητική, aria-hidden) ───────────────

  function sketch(q) {
    const bar = (width) => { const b = h('span', { class: 'sc-bar' }); b.style.setProperty('width', width); return b; };
    if (q.type === 'choice' || q.type === 'multi') {
      return h('div', { class: 'sc-ui' }, [72, 54, 63].map((w, i) => h('div', { class: 'sc-row' }, [
        h('span', { class: 'sc-dot' + (i === 1 ? ' on' : '') }), bar(w + '%')
      ])));
    }
    if (q.type === 'rating') {
      return h('div', { class: 'sc-ui' }, h('div', { class: 'sc-scale' }, [0, 1, 2, 3, 4].map((i) => (
        h('span', { class: 'sc-cell' + (i === 3 ? ' on' : i < 3 ? ' half' : '') })
      ))));
    }
    return h('div', { class: 'sc-ui' }, h('div', { class: 'sc-lines' }, [bar('92%'), bar('78%'), bar('44%')]));
  }

  function buildStack() {
    const host = document.getElementById('hero-stack');
    if (!host || !QUESTIONS.length) return;
    const items = QUESTIONS.slice(0, 4);
    const plane = h('div', { class: 'stack-plane' }, [
      h('div', { class: 'stack-shadow' }),
      h('span', { class: 'stack-guide g1' }), h('span', { class: 'stack-guide g2' }),
      h('span', { class: 'stack-guide g3' }), h('span', { class: 'stack-guide g4' })
    ]);
    plane.style.setProperty('--depth', String(Math.max(1, items.length - 1)));
    // Από το πιο «βαθύ» φύλλο προς το πάνω: η ερώτηση 01 είναι στην κορυφή.
    for (let index = items.length - 1; index >= 0; index--) {
      const q = items[index];
      const card = h('div', { class: 'stack-card' + (index === 0 ? ' is-top' : '') }, [
        h('div', { class: 'sc-head' }, [h('span', { class: 'sc-num', text: pad2(index + 1) }), h('span', { class: 'sc-type', text: TYPE_LABELS[q.type] })]),
        h('p', { class: 'sc-label', text: q.label }),
        sketch(q)
      ]);
      card.style.setProperty('--i', String(items.length - 1 - index));
      plane.appendChild(card);
    }
    host.appendChild(plane);
    const caption = document.getElementById('stack-caption');
    if (caption) {
      clear(caption).append(h('b', { text: 'Εικ. 1' }), ' — ' + QUESTIONS.length + (QUESTIONS.length === 1 ? ' ερώτηση' : ' ερωτήσεις') + ', ~' + minutes + ' λεπτ' + (minutes === 1 ? 'ό' : 'ά'));
    }
  }

  // ─── ΔΗΜΙΟΥΡΓΙΑ ΠΕΔΙΩΝ ──────────────────────────────────────────────────

  function buildQuestion(q, index) {
    const labelId = 'q-' + q.id + '-label';
    const helpId = 'q-' + q.id + '-help';
    const errorId = 'q-' + q.id + '-error';
    const describedBy = [q.help ? helpId : '', errorId].filter(Boolean).join(' ');

    let body;
    if (q.type === 'choice' || q.type === 'multi') body = buildOptions(q, labelId, describedBy);
    else if (q.type === 'rating') body = buildRating(q, labelId, describedBy);
    else body = buildText(q, labelId, describedBy);

    const card = h('div', { class: 'q-card reveal' }, [
      h('div', { class: 'q-head' }, [
        h('span', { class: 'q-num', 'aria-hidden': 'true' }, [pad2(index + 1), h('span', { class: 'q-of', text: '/ ' + pad2(QUESTIONS.length) })]),
        h('span', { class: 'q-badge q-badge-todo', text: q.required ? 'Υποχρεωτική' : 'Προαιρετική' }),
        h('span', { class: 'q-badge q-badge-done', 'aria-hidden': 'true' }, [icon('check'), 'Απαντήθηκε'])
      ]),
      h('h2', { class: 'q-label', id: labelId, text: q.label }),
      q.help ? h('p', { class: 'q-help', id: helpId, text: q.help }) : null,
      h('div', { class: 'q-body' }, body),
      h('p', { class: 'q-error', id: errorId }, [icon('alert'), h('span', { class: 'q-error-text' })])
    ]);
    card.style.setProperty('--delay', (index * 60) + 'ms');

    return h('section', { class: 'q-shell', 'data-qid': q.id, 'data-type': q.type }, card);
  }

  function buildOptions(q, labelId, describedBy) {
    const multi = q.type === 'multi';
    const group = h('div', {
      class: 'options' + (q.options.length > 4 ? ' is-grid' : ''),
      role: multi ? 'group' : 'radiogroup',
      'aria-labelledby': labelId,
      'aria-describedby': describedBy,
      'aria-required': q.required && !multi ? 'true' : null
    });
    q.options.forEach((option) => {
      group.appendChild(h('label', { class: 'opt' }, [
        h('input', { class: 'opt-input', type: multi ? 'checkbox' : 'radio', name: q.id, value: option }),
        h('span', { class: 'opt-box' }, [
          h('span', { class: 'opt-dot', 'aria-hidden': 'true' }),
          h('span', { class: 'opt-text', text: option })
        ])
      ]));
    });
    if (multi && q.maxSelections) {
      return h('div', null, [group, h('p', { class: 'q-note', text: 'Έως ' + q.maxSelections + ' επιλογές.' })]);
    }
    return group;
  }

  function buildRating(q, labelId, describedBy) {
    const caption = h('p', { class: 'rating-caption', 'aria-live': 'polite', text: 'Επιλέξτε βαθμολογία' });
    const group = h('div', {
      class: 'rating',
      role: 'radiogroup',
      'aria-labelledby': labelId,
      'aria-describedby': describedBy,
      'aria-required': q.required ? 'true' : null
    });
    group.style.setProperty('--n', String(q.max - q.min + 1));
    const labelFor = (value) => q.labels[value - q.min] || '';

    for (let v = q.min; v <= q.max; v++) {
      const text = labelFor(v);
      group.appendChild(h('label', { class: 'rate', 'data-value': v }, [
        h('input', {
          class: 'rate-input', type: 'radio', name: q.id, value: v,
          'aria-label': v + ' από ' + q.max + (text ? ' — ' + text : '')
        }),
        h('span', { class: 'rate-num', text: String(v) })
      ]));
    }

    // Η επιλεγμένη τιμή γεμίζει· οι μικρότερες παίρνουν απαλό χρώμα (σαν χάρακας).
    const paint = (preview) => {
      const checked = group.querySelector('input:checked');
      const value = checked ? Number(checked.value) : 0;
      group.querySelectorAll('.rate').forEach((el) => {
        const v = Number(el.dataset.value);
        el.classList.toggle('is-lit', v === value);
        el.classList.toggle('is-below', value > 0 && v < value);
      });
      const shown = preview || value;
      caption.textContent = shown
        ? shown + ' / ' + q.max + (labelFor(shown) ? ' · ' + labelFor(shown) : '')
        : 'Επιλέξτε βαθμολογία';
      caption.classList.toggle('is-set', Boolean(value) && (!preview || preview === value));
    };
    group.addEventListener('pointerover', (e) => {
      const rate = e.target.closest('.rate');
      if (rate) paint(Number(rate.dataset.value));
    });
    group.addEventListener('pointerleave', () => paint(0));
    group.addEventListener('change', () => paint(0));
    group.paint = paint;

    const ends = q.labels.length >= 2
      ? h('div', { class: 'rating-ends', 'aria-hidden': 'true' }, [
        h('span', { text: q.min + ' · ' + q.labels[0] }),
        h('span', { text: q.labels[q.labels.length - 1] + ' · ' + q.max })
      ])
      : null;

    return h('div', { class: 'rating-wrap' }, [group, ends, caption]);
  }

  function buildText(q, labelId, describedBy) {
    const multiline = q.type === 'textarea';
    const input = h(multiline ? 'textarea' : 'input', {
      class: 'field-input',
      id: 'q-' + q.id,
      name: q.id,
      type: multiline ? null : 'text',
      rows: multiline ? 4 : null,
      maxlength: q.maxLength,
      placeholder: q.placeholder || 'Η απάντησή σας',
      autocomplete: 'off',
      spellcheck: 'true',
      'aria-labelledby': labelId,
      'aria-describedby': describedBy,
      'aria-required': q.required ? 'true' : null
    });
    const counter = h('span', { class: 'field-counter', 'aria-hidden': 'true', text: '0 / ' + format.number(q.maxLength) });
    const update = () => {
      const len = input.value.length;
      counter.textContent = format.number(len) + ' / ' + format.number(q.maxLength);
      counter.classList.toggle('is-near', len > q.maxLength * 0.9);
      if (multiline) {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight + 2, 420) + 'px';
      }
    };
    input.addEventListener('input', update);
    input.update = update;
    return h('div', { class: 'field' }, [
      input,
      h('div', { class: 'field-meta' }, [h('span', { class: 'field-hint', text: multiline ? 'Ελεύθερο κείμενο' : '' }), counter])
    ]);
  }

  // ─── ΑΝΑΓΝΩΣΗ & ΕΛΕΓΧΟΣ ────────────────────────────────────────────────

  function fieldsOf(q) {
    return els.form.querySelectorAll('[name="' + CSS.escape(q.id) + '"]');
  }

  function shellOf(q) {
    return els.list.querySelector('[data-qid="' + CSS.escape(q.id) + '"]');
  }

  function readAnswer(q) {
    const fields = Array.from(fieldsOf(q));
    if (q.type === 'choice') { const c = fields.find((f) => f.checked); return c ? c.value : ''; }
    if (q.type === 'multi') return fields.filter((f) => f.checked).map((f) => f.value);
    if (q.type === 'rating') { const c = fields.find((f) => f.checked); return c ? Number(c.value) : ''; }
    return fields[0] ? fields[0].value.trim() : '';
  }

  const isEmpty = (v) => v === '' || (Array.isArray(v) && v.length === 0);

  function validate(q, value) {
    if (q.required && isEmpty(value)) {
      return q.type === 'text' || q.type === 'textarea' ? 'Παρακαλούμε γράψτε μια απάντηση.' : 'Παρακαλούμε επιλέξτε μια απάντηση.';
    }
    if (q.type === 'multi' && q.maxSelections && value.length > q.maxSelections) return 'Επιλέξτε έως ' + q.maxSelections + '.';
    if ((q.type === 'text' || q.type === 'textarea') && value.length > q.maxLength) return 'Έως ' + q.maxLength + ' χαρακτήρες.';
    return '';
  }

  function setError(q, message) {
    const shell = shellOf(q);
    if (!shell) return;
    shell.classList.toggle('has-error', Boolean(message));
    shell.querySelector('.q-error-text').textContent = message;
    fieldsOf(q).forEach((f) => (message ? f.setAttribute('aria-invalid', 'true') : f.removeAttribute('aria-invalid')));
    const group = shell.querySelector('[role="radiogroup"], [role="group"]');
    if (group) (message ? group.setAttribute('aria-invalid', 'true') : group.removeAttribute('aria-invalid'));
  }

  function collect() {
    const answers = {};
    const errors = [];
    QUESTIONS.forEach((q) => {
      const value = readAnswer(q);
      const message = validate(q, value);
      setError(q, message);
      if (message) errors.push(q);
      answers[q.id] = value;
    });
    return { answers, errors };
  }

  // ─── ΠΡΟΟΔΟΣ & ΠΡΟΧΕΙΡΟ ─────────────────────────────────────────────────

  function updateProgress() {
    const done = QUESTIONS.filter((q) => !isEmpty(readAnswer(q))).length;
    const ratio = QUESTIONS.length ? done / QUESTIONS.length : 0;
    els.progressBar.style.setProperty('--progress', ratio.toFixed(3));
    clear(els.progressText).append(h('b', { text: String(done) }), ' / ' + QUESTIONS.length);
    document.documentElement.classList.toggle('is-complete', ratio === 1);
    QUESTIONS.forEach((q) => {
      const shell = shellOf(q);
      if (shell) shell.classList.toggle('is-answered', !isEmpty(readAnswer(q)));
    });
  }

  let draftTimer = 0;
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      // Όχι κατά την αποστολή ή μετά την επιτυχία: τότε το πρόχειρο πρέπει να έχει σβηστεί.
      if (sending || els.form.hidden) return;
      const answers = {};
      QUESTIONS.forEach((q) => { answers[q.id] = readAnswer(q); });
      store.set('sessionStorage', DRAFT_KEY, JSON.stringify({ sig: DRAFT_SIG, answers }));
    }, 250);
  }

  function restoreDraft() {
    let draft = null;
    try { draft = JSON.parse(store.get('sessionStorage', DRAFT_KEY) || 'null'); } catch (e) { draft = null; }
    if (!draft || draft.sig !== DRAFT_SIG || !draft.answers) return false;
    let restored = false;
    QUESTIONS.forEach((q) => {
      const value = draft.answers[q.id];
      if (value === undefined || value === null || isEmpty(value)) return;
      const values = (Array.isArray(value) ? value : [value]).map(String);
      fieldsOf(q).forEach((f) => {
        if (f.type === 'radio' || f.type === 'checkbox') f.checked = values.indexOf(f.value) !== -1;
        else f.value = String(value).slice(0, q.maxLength || 2000);
        if (typeof f.update === 'function') f.update();
      });
      const group = shellOf(q) && shellOf(q).querySelector('.rating');
      if (group && group.paint) group.paint(0);
      restored = true;
    });
    return restored;
  }

  // ─── ΑΠΟΣΤΟΛΗ ───────────────────────────────────────────────────────────

  function setStatus(message, type) {
    clear(els.status);
    els.status.className = 'form-status' + (type ? ' is-' + type : '');
    if (message) els.status.append(icon(type === 'error' ? 'alert' : 'info'), h('span', { text: message }));
  }

  function setSending(value) {
    sending = value;
    els.fields.disabled = value;
    els.submit.disabled = value;
    els.submit.classList.toggle('is-loading', value);
    els.submit.setAttribute('aria-busy', String(value));
    els.submitLabel.textContent = value ? 'Αποστολή…' : S.submitLabel;
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (sending) return;

    const { answers, errors } = collect();
    if (errors.length) {
      const first = shellOf(errors[0]);
      setStatus(errors.length === 1 ? 'Λείπει 1 υποχρεωτική απάντηση.' : 'Λείπουν ' + errors.length + ' υποχρεωτικές απαντήσεις.', 'error');
      if (first) {
        first.scrollIntoView({ behavior: window.EF.motionOK() ? 'smooth' : 'auto', block: 'center' });
        first.classList.remove('shake');
        void first.offsetWidth; // επανεκκίνηση του animation
        first.classList.add('shake');
        const focusable = first.querySelector('input, textarea');
        if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 350);
      }
      return;
    }

    if (!config.configured) {
      setStatus(ERRORS.not_configured, 'error');
      return;
    }

    setStatus('', '');
    setSending(true);
    try {
      const payload = {
        answers,
        meta: { hp: els.honeypot.value, elapsed: Date.now() - startedAt, sid: submissionId }
      };
      const res = await window.EF.request(config.scriptUrl, { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw Object.assign(new Error(res.error), { code: res.error || 'default' });
      onSuccess();
    } catch (err) {
      const code = err && err.code ? err.code : 'default';
      if (code === 'network' || code === 'bad_response') {
        console.warn('[E.form] Αποτυχία αποστολής (' + code + '). Ελέγξτε το scriptUrl στο config.js και ότι η ανάπτυξη έχει πρόσβαση «Οποιοσδήποτε».');
      }
      const message = ERRORS[code] || ERRORS.default;
      setStatus(message, 'error');
      window.EF.toast(message, { type: 'error' });
    } finally {
      setSending(false);
    }
  }

  function onSuccess() {
    clearTimeout(draftTimer);
    window.EF.dismissToasts('error');
    store.remove('sessionStorage', DRAFT_KEY);
    els.form.hidden = true;
    els.success.hidden = false;
    document.documentElement.classList.add('is-submitted');
    window.requestAnimationFrame(() => els.success.classList.add('is-in'));
    els.success.scrollIntoView({ behavior: window.EF.motionOK() ? 'smooth' : 'auto', block: 'center' });
    setTimeout(() => els.success.focus({ preventScroll: true }), 400);
  }

  function resetForm() {
    els.form.reset();
    QUESTIONS.forEach((q) => {
      setError(q, '');
      fieldsOf(q).forEach((f) => { if (typeof f.update === 'function') f.update(); });
    });
    els.list.querySelectorAll('.rating').forEach((g) => g.paint && g.paint(0));
    submissionId = window.EF.uid();
    setStatus('', '');
    updateProgress();
    els.success.classList.remove('is-in');
    els.success.hidden = true;
    els.form.hidden = false;
    document.documentElement.classList.remove('is-submitted');
    const first = els.list.querySelector('.q-shell');
    if (first) first.scrollIntoView({ behavior: window.EF.motionOK() ? 'smooth' : 'auto', block: 'center' });
  }

  // ─── ΕΚΚΙΝΗΣΗ ───────────────────────────────────────────────────────────

  function init() {
    paintCopy();
    buildStack();
    window.EF.initThemeToggle(document.getElementById('theme-toggle'));

    if (!QUESTIONS.length) {
      els.list.appendChild(h('p', { class: 'notice', text: 'Δεν έχουν οριστεί ερωτήσεις στο config.js.' }));
      els.submit.disabled = true;
    }
    QUESTIONS.forEach((q, i) => els.list.appendChild(buildQuestion(q, i)));
    if (!config.configured) els.configWarning.hidden = false;

    const hadDraft = restoreDraft();
    updateProgress();
    if (hadDraft) window.EF.toast('Επαναφέραμε τις απαντήσεις που είχατε αρχίσει να συμπληρώνετε.', { type: 'info' });

    els.form.addEventListener('submit', onSubmit);
    els.form.addEventListener('input', () => { updateProgress(); saveDraft(); });
    els.form.addEventListener('change', (e) => {
      updateProgress();
      saveDraft();
      const shell = e.target.closest('.q-shell');
      const q = shell && QUESTIONS.find((item) => item.id === shell.dataset.qid);
      if (q && shell.classList.contains('has-error')) setError(q, validate(q, readAnswer(q)));
    });
    els.again.addEventListener('click', resetForm);

    document.getElementById('start-btn').addEventListener('click', () => {
      const first = els.list.querySelector('.q-shell');
      if (!first) return;
      first.scrollIntoView({ behavior: window.EF.motionOK() ? 'smooth' : 'auto', block: 'center' });
      const input = first.querySelector('input, textarea');
      if (input) setTimeout(() => input.focus({ preventScroll: true }), 650);
    });

    window.EF.onScroll((s) => document.documentElement.classList.toggle('is-scrolled', s.y > 24));
    window.EF.reveal();
    window.EF.focusScroll('.q-shell');
    document.documentElement.classList.add('is-ready');
  }

  init();
})();
