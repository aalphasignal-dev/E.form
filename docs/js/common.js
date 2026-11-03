/*
 * E.form — κοινός κώδικας για φόρμα & dashboard.
 * Κανόνας ασφαλείας: ΠΟΤΕ innerHTML με δεδομένα. Όλα τα κείμενα μπαίνουν με textContent.
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !reducedMotion.matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // ─── DOM ───────────────────────────────────────────────────────────────

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((key) => {
        const value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key.slice(0, 2) === 'on' && typeof value === 'function') el.addEventListener(key.slice(2), value);
        else if (value === true) el.setAttribute(key, '');
        else el.setAttribute(key, String(value));
      });
    }
    append(el, children);
    return el;
  }

  function append(el, children) {
    if (children === null || children === undefined) return el;
    (Array.isArray(children) ? children : [children]).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      el.appendChild(typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child);
    });
    return el;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  // ─── ΕΙΚΟΝΙΔΙΑ (στατικά SVG, χωρίς εξωτερικά αρχεία) ───────────────────

  const ICONS = {
    check: ['p:M20 6 9 17l-5-5'],
    star: ['f:M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z'],
    sun: ['c:12,12,4', 'p:M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'],
    moon: ['p:M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
    lock: ['r:4,11,16,10,2.5', 'p:M8 11V7.5a4 4 0 0 1 8 0V11', 'p:M12 15v2'],
    refresh: ['p:M21 12a9 9 0 1 1-2.64-6.36L21 8', 'p:M21 3v5h-5'],
    download: ['p:M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'p:M7 10l5 5 5-5', 'p:M12 15V3'],
    logout: ['p:M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'p:M16 17l5-5-5-5', 'p:M21 12H9'],
    eye: ['p:M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'c:12,12,3'],
    eyeOff: ['p:M17.94 17.94A10.1 10.1 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94', 'p:M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19', 'p:M14.12 14.12a3 3 0 1 1-4.24-4.24', 'p:M2 2l20 20'],
    alert: ['p:M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'p:M12 9v4', 'p:M12 17h.01'],
    info: ['c:12,12,10', 'p:M12 16v-4', 'p:M12 8h.01'],
    shield: ['p:M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'p:M9 12l2 2 4-4'],
    arrowDown: ['p:M12 5v14', 'p:M19 12l-7 7-7-7'],
    arrowRight: ['p:M5 12h14', 'p:M12 5l7 7-7 7'],
    search: ['c:11,11,7', 'p:M21 21l-4.3-4.3'],
    clock: ['c:12,12,9', 'p:M12 7v5l3 2'],
    chevronLeft: ['p:M15 18l-6-6 6-6'],
    chevronRight: ['p:M9 18l6-6-6-6'],
    sparkle: ['p:M12 3l1.9 5.8L20 10.7l-6.1 1.2L12 18l-1.9-6.1L4 10.7l6.1-1.9z', 'p:M19 3v4M17 5h4'],
    users: ['p:M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'c:9,7,4', 'p:M23 21v-2a4 4 0 0 0-3-3.87', 'p:M16 3.13a4 4 0 0 1 0 7.75'],
    activity: ['p:M22 12h-4l-3 9L9 3l-3 9H2'],
    message: ['p:M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
    target: ['c:12,12,9', 'c:12,12,5', 'c:12,12,1'],
    x: ['p:M18 6 6 18', 'p:M6 6l12 12'],
    table: ['r:3,4,18,16,2', 'p:M3 10h18M9 10v10'],
    live: ['c:12,12,3', 'p:M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8']
  };

  function icon(name, className) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon' + (className ? ' ' + className : ''));
    (ICONS[name] || []).forEach((spec) => {
      const kind = spec[0];
      const data = spec.slice(2);
      let node;
      if (kind === 'c') {
        const [cx, cy, r] = data.split(',');
        node = document.createElementNS(SVG_NS, 'circle');
        node.setAttribute('cx', cx); node.setAttribute('cy', cy); node.setAttribute('r', r);
      } else if (kind === 'r') {
        const [x, y, w, hh, rx] = data.split(',');
        node = document.createElementNS(SVG_NS, 'rect');
        node.setAttribute('x', x); node.setAttribute('y', y);
        node.setAttribute('width', w); node.setAttribute('height', hh); node.setAttribute('rx', rx);
      } else {
        node = document.createElementNS(SVG_NS, 'path');
        node.setAttribute('d', data);
        if (kind === 'f') node.setAttribute('class', 'icon-fill');
      }
      svg.appendChild(node);
    });
    return svg;
  }

  // ─── ΡΥΘΜΙΣΕΙΣ (έλεγχος του config.js) ─────────────────────────────────

  const FIELD_ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  const SCRIPT_URL_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
  const TYPES = ['choice', 'multi', 'rating', 'text', 'textarea'];

  function deepFreeze(obj) {
    Object.values(obj).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); });
    return Object.freeze(obj);
  }

  function loadConfig() {
    const raw = window.EFORM_CONFIG || {};
    const problems = [];
    const seen = new Set();
    const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

    const questions = (Array.isArray(raw.questions) ? raw.questions : []).reduce((list, q, index) => {
      const where = 'ερώτηση #' + (index + 1);
      if (!q || typeof q !== 'object') { problems.push(where + ': δεν είναι αντικείμενο'); return list; }
      if (!FIELD_ID_RE.test(q.id || '') || q.id === 'timestamp') { problems.push(where + ': μη έγκυρο id'); return list; }
      if (seen.has(q.id)) { problems.push(where + ': διπλό id «' + q.id + '»'); return list; }
      if (TYPES.indexOf(q.type) === -1) { problems.push(where + ': άγνωστος τύπος «' + q.type + '»'); return list; }
      const item = {
        id: q.id,
        type: q.type,
        label: str(q.label, q.id),
        help: str(q.help, ''),
        required: q.required === true,
        placeholder: str(q.placeholder, '')
      };
      if (q.type === 'choice' || q.type === 'multi') {
        const options = (Array.isArray(q.options) ? q.options : [])
          .filter((o) => typeof o === 'string' && o.trim())
          .map((o) => o.trim().replace(/;/g, ','));
        if (!options.length) { problems.push(where + ': λείπουν οι επιλογές (options)'); return list; }
        item.options = Array.from(new Set(options));
        if (q.type === 'multi') item.maxSelections = Number.isInteger(q.maxSelections) && q.maxSelections > 0 ? q.maxSelections : 0;
      }
      if (q.type === 'rating') {
        item.min = Number.isInteger(q.min) ? clamp(q.min, 0, 1) : 1;
        item.max = Number.isInteger(q.max) ? clamp(q.max, item.min + 1, 10) : 5;
        item.labels = Array.isArray(q.labels) ? q.labels.map((l) => String(l)) : [];
      }
      if (q.type === 'text' || q.type === 'textarea') {
        const fallback = q.type === 'text' ? 200 : 1000;
        item.maxLength = Number.isInteger(q.maxLength) ? clamp(q.maxLength, 1, 2000) : fallback;
      }
      seen.add(q.id);
      list.push(item);
      return list;
    }, []);

    const survey = Object.assign({
      brand: 'E.form',
      eyebrow: 'Ερωτηματολόγιο',
      title: 'Ερωτηματολόγιο',
      subtitle: '',
      submitLabel: 'Αποστολή',
      successTitle: 'Ευχαριστούμε!',
      successText: 'Η απάντησή σας καταχωρήθηκε.'
    }, raw.survey && typeof raw.survey === 'object' ? raw.survey : {});

    // Λογότυπο: μόνο τοπικό αρχείο μέσα στο docs/ (π.χ. 'assets/logo.svg'), για να ισχύει το αυστηρό CSP.
    const logo = typeof survey.logo === 'string' ? survey.logo.trim() : '';
    survey.logo = /^(?![/\\])(?!.*\.\.)[A-Za-z0-9_\-/.]+\.(svg|png|webp|jpe?g)$/i.test(logo) ? logo : '';
    if (logo && !survey.logo) problems.push('survey.logo: δεκτό μόνο τοπικό αρχείο εικόνας, π.χ. assets/logo.svg');
    if (problems.length) console.warn('[E.form] Προβλήματα στο config.js:\n• ' + problems.join('\n• '));

    const scriptUrl = typeof raw.scriptUrl === 'string' ? raw.scriptUrl.trim() : '';
    return deepFreeze({ scriptUrl, configured: SCRIPT_URL_RE.test(scriptUrl), survey, questions });
  }

  // ─── ΔΙΚΤΥΟ ────────────────────────────────────────────────────────────

  function requestError(code, cause) {
    const err = new Error(code);
    err.code = code;
    if (cause) err.cause = cause;
    return err;
  }

  /**
   * fetch προς το Apps Script. Το body στέλνεται ως text/plain ώστε ο browser να
   * ΜΗΝ κάνει CORS preflight (το Apps Script δεν απαντά σε OPTIONS).
   * credentials: 'omit' → δεν στέλνονται cookies του Google λογαριασμού.
   */
  async function request(url, options) {
    const opts = options || {};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout || 25000);
    try {
      let res;
      try {
        res = await fetch(url, {
          method: opts.method || 'GET',
          body: opts.body,
          headers: opts.body ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
          signal: controller.signal,
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'follow',
          referrerPolicy: 'no-referrer'
        });
      } catch (err) {
        throw requestError(controller.signal.aborted ? 'timeout' : 'network', err);
      }
      if (!res.ok) throw requestError('http_' + res.status);
      let data;
      try { data = await res.json(); } catch (err) { throw requestError('bad_response', err); }
      if (!data || typeof data !== 'object') throw requestError('bad_response');
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── ΑΠΟΘΗΚΕΥΣΗ (ασφαλής σε ιδιωτική περιήγηση) ───────────────────────

  const store = {
    get(area, key) { try { return window[area].getItem(key); } catch (e) { return null; } },
    set(area, key, value) { try { window[area].setItem(key, value); } catch (e) { /* γεμάτο ή μπλοκαρισμένο */ } },
    remove(area, key) { try { window[area].removeItem(key); } catch (e) { /* — */ } }
  };

  // ─── ΜΟΡΦΟΠΟΙΗΣΗ ───────────────────────────────────────────────────────

  const nf = new Intl.NumberFormat('el-GR');
  const nf1 = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pf = new Intl.NumberFormat('el-GR', { style: 'percent', maximumFractionDigits: 0 });
  const dtf = new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const df = new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short' });
  const tf = new Intl.DateTimeFormat('el-GR', { hour: '2-digit', minute: '2-digit' });
  const rtf = new Intl.RelativeTimeFormat('el', { numeric: 'auto' });

  function relativeTime(date) {
    const diff = (date.getTime() - Date.now()) / 1000;
    const abs = Math.abs(diff);
    if (abs < 45) return 'μόλις τώρα';
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    return dtf.format(date);
  }

  const format = {
    number: (n) => nf.format(n),
    decimal: (n) => nf1.format(n),
    percent: (n) => pf.format(n),
    dateTime: (d) => dtf.format(d),
    day: (d) => df.format(d),
    time: (d) => tf.format(d),
    relative: relativeTime
  };

  // ─── ΘΕΜΑ (σκούρο / ανοιχτό) ───────────────────────────────────────────

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function initThemeToggle(button) {
    if (!button) return;
    const paint = () => {
      const light = currentTheme() === 'light';
      clear(button).appendChild(icon(light ? 'moon' : 'sun'));
      button.setAttribute('aria-label', light ? 'Σκούρο θέμα' : 'Ανοιχτό θέμα');
      button.setAttribute('title', light ? 'Σκούρο θέμα' : 'Ανοιχτό θέμα');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', light ? '#f7f6f2' : '#0f0f0e');
    };
    button.addEventListener('click', () => {
      const next = currentTheme() === 'light' ? 'dark' : 'light';
      document.documentElement.classList.add('theme-anim');
      document.documentElement.setAttribute('data-theme', next);
      store.set('localStorage', 'eform.theme', next);
      paint();
      window.dispatchEvent(new CustomEvent('eform:theme', { detail: next }));
      setTimeout(() => document.documentElement.classList.remove('theme-anim'), 500);
    });
    paint();
  }

  // ─── SCROLL STATE ──────────────────────────────────────────────────────

  const scroll = { y: window.scrollY, progress: 0 };
  const scrollSubscribers = new Set();
  let scrollTicking = false;

  function updateScroll() {
    scrollTicking = false;
    scroll.y = window.scrollY;
    scroll.progress = clamp(scroll.y / (window.innerHeight * 0.85), 0, 1);
    document.documentElement.style.setProperty('--scroll-p', scroll.progress.toFixed(4));
    scrollSubscribers.forEach((fn) => fn(scroll));
  }
  function requestScrollUpdate() {
    if (!scrollTicking) { scrollTicking = true; window.requestAnimationFrame(updateScroll); }
  }
  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate, { passive: true });
  function onScroll(fn) { scrollSubscribers.add(fn); requestScrollUpdate(); return () => scrollSubscribers.delete(fn); }

  // ─── ΚΙΝΗΣΗ ΚΑΤΑ ΤΟ SCROLL ─────────────────────────────────────────────

  let revealObserver = null;
  function reveal(elements) {
    const list = Array.from(elements || document.querySelectorAll('.reveal:not(.is-visible)'));
    if (!motionOK() || !('IntersectionObserver' in window)) {
      list.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    }
    list.forEach((el) => revealObserver.observe(el));
  }

  /**
   * «Εστίαση»: σημειώνει ως ενεργό (.is-active) το στοιχείο που βρίσκεται πιο κοντά
   * στο κέντρο της οθόνης. Το CSS κάνει τα υπόλοιπα να υποχωρούν διακριτικά.
   */
  function focusScroll(selector) {
    if (!motionOK()) return;
    document.documentElement.classList.add('focus-on');
    let current = null;
    const setActive = (el) => {
      if (el === current) return;
      if (current) current.classList.remove('is-active');
      if (el) el.classList.add('is-active');
      current = el;
    };
    onScroll(() => {
      const vh = window.innerHeight;
      let best = null;
      let bestDist = Infinity;
      document.querySelectorAll(selector).forEach((el) => {
        if (el.offsetParent === null) return;
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const d = Math.abs(r.top + r.height / 2 - vh / 2);
        if (d < bestDist) { bestDist = d; best = el; }
      });
      setActive(best);
    });
    // Με το πληκτρολόγιο (Tab) η εστίαση ακολουθεί το πεδίο.
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest && e.target.closest(selector);
      if (el) setActive(el);
    });
  }

  /** Αριθμός που «μετράει» μέχρι την τιμή του. */
  function countUp(el, value, formatter) {
    const fmt = formatter || format.number;
    const from = Number(el.dataset.value || 0);
    el.dataset.value = String(value);
    if (!motionOK() || from === value) { el.textContent = fmt(value); return; }
    const start = performance.now();
    const duration = 900;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (value - from) * eased);
      if (t < 1) window.requestAnimationFrame(step);
      else el.textContent = fmt(value);
    };
    window.requestAnimationFrame(step);
  }

  // ─── ΕΙΔΟΠΟΙΗΣΕΙΣ ──────────────────────────────────────────────────────

  function toast(message, options) {
    const opts = Object.assign({ type: 'info', timeout: 4500 }, options || {});
    let region = document.getElementById('toasts');
    if (!region) { region = h('div', { id: 'toasts', class: 'toasts' }); document.body.appendChild(region); }
    const iconName = opts.type === 'error' ? 'alert' : opts.type === 'success' ? 'check' : 'info';
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      node.classList.remove('is-in');
      setTimeout(() => node.remove(), 320);
    };
    const node = h('div', { class: 'toast toast-' + opts.type, role: opts.type === 'error' ? 'alert' : 'status' }, [
      h('span', { class: 'toast-icon' }, icon(iconName)),
      h('span', { class: 'toast-msg', text: message }),
      h('button', { class: 'toast-close', type: 'button', 'aria-label': 'Κλείσιμο', onclick: close }, icon('x'))
    ]);
    region.appendChild(node);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => node.classList.add('is-in')));
    if (opts.timeout) setTimeout(close, opts.timeout);
    return close;
  }

  /** Κλείνει όσες ειδοποιήσεις είναι ανοιχτές (π.χ. ένα παλιό σφάλμα μετά από επιτυχία). */
  function dismissToasts(type) {
    document.querySelectorAll('.toast' + (type ? '.toast-' + type : '')).forEach((node) => {
      node.classList.remove('is-in');
      setTimeout(() => node.remove(), 320);
    });
  }

  window.EF = Object.freeze({
    h, append, clear, icon, clamp, motionOK,
    config: loadConfig(),
    request, uid, store, format,
    currentTheme, initThemeToggle,
    onScroll, reveal, focusScroll, countUp,
    toast, dismissToasts
  });
})();
