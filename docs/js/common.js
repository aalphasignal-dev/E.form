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

    if (problems.length) console.warn('[E.form] Προβλήματα στο config.js:\n• ' + problems.join('\n• '));

    const survey = Object.assign({
      brand: 'E.form',
      eyebrow: 'Ερωτηματολόγιο',
      title: 'Ερωτηματολόγιο',
      subtitle: '',
      submitLabel: 'Αποστολή',
      successTitle: 'Ευχαριστούμε!',
      successText: 'Η απάντησή σας καταχωρήθηκε.'
    }, raw.survey && typeof raw.survey === 'object' ? raw.survey : {});

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
      if (meta) meta.setAttribute('content', light ? '#f4f5fa' : '#06070c');
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

  // ─── 3D ΣΚΗΝΗ: σφαίρα από σωματίδια που αντιδρά σε scroll & ποντίκι ────

  function createScene(canvas, options) {
    const opts = Object.assign({ layout: 'hero', dim: 1 }, options || {});
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return null;

    const small = Math.min(window.innerWidth, window.innerHeight) < 640;
    const N = small ? 620 : 1150;
    const RING = small ? 150 : 280;
    const STARS = small ? 70 : 140;
    const sphere = new Float32Array(N * 3);
    const ring = new Float32Array(RING * 3);
    const stars = new Float32Array(STARS * 4);
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      sphere[i * 3] = Math.cos(t) * r;
      sphere[i * 3 + 1] = y;
      sphere[i * 3 + 2] = Math.sin(t) * r;
    }
    for (let i = 0; i < RING; i++) {
      const a = (i / RING) * Math.PI * 2;
      const rr = 1.32 + Math.random() * 0.2;
      ring[i * 3] = Math.cos(a) * rr;
      ring[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      ring[i * 3 + 2] = Math.sin(a) * rr;
    }
    for (let i = 0; i < STARS; i++) {
      stars[i * 4] = Math.random();
      stars[i * 4 + 1] = Math.random();
      stars[i * 4 + 2] = 0.2 + Math.random() * 0.8; // βάθος
      stars[i * 4 + 3] = Math.random() * Math.PI * 2; // φάση
    }

    const PALETTES = {
      dark: { dots: ['#a78bfa', '#7c8cff', '#4f9dff', '#3fd0f0'], glow: 'rgba(110,110,255,0.20)', alpha: [0.16, 0.42, 0.95], star: '#c7d2fe', blend: 'lighter' },
      light: { dots: ['#7457e6', '#4f63e8', '#2a78d6', '#0f9fc4'], glow: 'rgba(96,108,255,0.14)', alpha: [0.12, 0.32, 0.75], star: '#6366f1', blend: 'source-over' }
    };

    let w = 0; let hgt = 0; let dpr = 1;
    let rot = 0.6; let px = 0; let py = 0; let tx = 0; let ty = 0;
    let vel = 0; let lastY = window.scrollY; let running = false; let raf = 0;
    let dim = opts.dim; let dimTarget = opts.dim; let time = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; hgt = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw();
    }

    function draw() {
      const pal = PALETTES[currentTheme()];
      const p = opts.layout === 'hero' ? scroll.progress : 0;
      const wide = w > 960;
      ctx.clearRect(0, 0, w, hgt);
      if (w === 0 || hgt === 0) return;

      let R; let cx; let cy;
      if (opts.layout === 'hero') {
        R = Math.min(w, hgt) * (wide ? 0.35 : 0.37) * (1 + p * 0.4);
        cx = wide ? w * (0.75 - p * 0.2) : w * 0.5;
        cy = wide ? hgt * (0.52 - p * 0.08) : hgt * (0.27 - p * 0.05);
      } else {
        R = Math.min(w, hgt) * 0.42;
        cx = w * 0.5; cy = hgt * 0.5;
      }

      // Απαλή λάμψη πίσω από τη σφαίρα.
      const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.7);
      glow.addColorStop(0, pal.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = dim;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, hgt);

      ctx.globalCompositeOperation = pal.blend;

      // Αστέρια φόντου με parallax.
      ctx.fillStyle = pal.star;
      for (let i = 0; i < STARS; i++) {
        const depth = stars[i * 4 + 2];
        const sx = ((stars[i * 4] + px * 0.02 * depth) % 1 + 1) % 1 * w;
        const sy = ((stars[i * 4 + 1] - scroll.y * 0.00008 * depth + py * 0.02 * depth) % 1 + 1) % 1 * hgt;
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.6 + stars[i * 4 + 3]));
        ctx.globalAlpha = dim * depth * twinkle * 0.55;
        ctx.fillRect(sx, sy, depth * 1.6, depth * 1.6);
      }

      const ay = rot + px * 0.45;
      const ax = -0.32 + py * 0.28 + p * 0.85;
      const sinY = Math.sin(ay); const cosY = Math.cos(ay);
      const sinX = Math.sin(ax); const cosX = Math.cos(ax);
      const buckets = [];
      for (let b = 0; b < 12; b++) buckets.push(new Path2D());

      const plot = (x, y, z, colorIndex, sizeBoost) => {
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        const f = 3.2 / (3.2 + z2);
        const sx = cx + x1 * R * f;
        const sy = cy + y1 * R * f;
        const depth = clamp((1 - z2 / 1.8) / 2 + 0.25, 0, 1);
        const level = depth < 0.42 ? 0 : depth < 0.68 ? 1 : 2;
        const size = (0.55 + depth * 1.45) * sizeBoost * (small ? 0.9 : 1);
        const path = buckets[colorIndex * 3 + level];
        path.moveTo(sx + size, sy);
        path.arc(sx, sy, size, 0, Math.PI * 2);
      };

      for (let i = 0; i < N; i++) {
        const y = sphere[i * 3 + 1];
        const colorIndex = Math.min(3, Math.floor(((y + 1) / 2) * 4));
        plot(sphere[i * 3], y, sphere[i * 3 + 2], colorIndex, 1);
      }

      // Δακτύλιος σε κλίση, με δική του περιστροφή.
      const tilt = 0.42; const st = Math.sin(tilt); const ct = Math.cos(tilt);
      const spin = rot * 1.7; const ss = Math.sin(spin); const cs = Math.cos(spin);
      for (let i = 0; i < RING; i++) {
        const x0 = ring[i * 3] * cs - ring[i * 3 + 2] * ss;
        const z0 = ring[i * 3] * ss + ring[i * 3 + 2] * cs;
        const y0 = ring[i * 3 + 1];
        plot(x0, y0 * ct - z0 * st, y0 * st + z0 * ct, i % 2 ? 3 : 2, 0.8);
      }

      for (let b = 0; b < 12; b++) {
        ctx.globalAlpha = pal.alpha[b % 3] * dim;
        ctx.fillStyle = pal.dots[Math.floor(b / 3)];
        ctx.fill(buckets[b]);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    function frame() {
      if (!running) return;
      const y = window.scrollY;
      vel = vel * 0.88 + (y - lastY) * 0.12;
      lastY = y;
      time += 0.016;
      rot += 0.0017 + Math.min(Math.abs(vel), 80) * 0.00016;
      px += (tx - px) * 0.045;
      py += (ty - py) * 0.045;
      dim += (dimTarget - dim) * 0.06;
      draw();
      raf = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running || !motionOK() || document.hidden) return;
      running = true;
      lastY = window.scrollY;
      raf = window.requestAnimationFrame(frame);
    }
    function stop() { running = false; window.cancelAnimationFrame(raf); }

    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    reducedMotion.addEventListener('change', () => (motionOK() ? start() : (stop(), draw())));
    window.addEventListener('eform:theme', () => { if (!running) draw(); });
    onScroll(() => { if (!running) draw(); });

    resize();
    start();

    return {
      setDim(value) { dimTarget = value; if (!running) { dim = value; draw(); } }
    };
  }

  // ─── ΕΜΦΑΝΙΣΗ ΣΤΟΙΧΕΙΩΝ ΜΕ 3D ΚΙΝΗΣΗ ΚΑΤΑ ΤΟ SCROLL ────────────────────

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
   * «Τύμπανο» 3D: κάθε κάρτα γέρνει ανάλογα με την απόστασή της από το κέντρο
   * της οθόνης, σαν να κυλάει πάνω σε κύλινδρο. Η κάρτα με εστίαση μένει ίσια.
   */
  function depthScroll(selector) {
    if (!motionOK()) return;
    const run = () => {
      const vh = window.innerHeight;
      const strength = window.innerWidth < 640 ? 0.55 : 1;
      document.querySelectorAll(selector).forEach((el) => {
        if (el.contains(document.activeElement) && document.activeElement !== document.body) {
          el.style.setProperty('--rx', '0deg'); el.style.setProperty('--tz', '0px');
          return;
        }
        const rect = el.getBoundingClientRect();
        const d = clamp((rect.top + rect.height / 2 - vh / 2) / vh, -1.2, 1.2);
        const ease = Math.sign(d) * Math.pow(Math.abs(d), 1.35);
        el.style.setProperty('--rx', (ease * -16 * strength).toFixed(2) + 'deg');
        el.style.setProperty('--tz', (-Math.abs(ease) * 140 * strength).toFixed(1) + 'px');
      });
    };
    onScroll(run);
    document.addEventListener('focusin', run);
    document.addEventListener('focusout', () => setTimeout(run, 0));
  }

  /** Κλίση 3D προς το ποντίκι για στοιχεία με [data-tilt]. */
  function tilt(root) {
    if (!motionOK() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    (root || document).querySelectorAll('[data-tilt]').forEach((el) => {
      if (el.dataset.tiltBound) return;
      el.dataset.tiltBound = '1';
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--tilt-x', (y * -7).toFixed(2) + 'deg');
        el.style.setProperty('--tilt-y', (x * 9).toFixed(2) + 'deg');
        el.style.setProperty('--glare-x', ((x + 0.5) * 100).toFixed(1) + '%');
        el.style.setProperty('--glare-y', ((y + 0.5) * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--tilt-x', '0deg');
        el.style.setProperty('--tilt-y', '0deg');
      });
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

  function confetti() {
    if (!motionOK()) return;
    const canvas = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth; const hh = window.innerHeight;
    canvas.width = w * dpr; canvas.height = hh * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#8b7cff', '#4f8dff', '#2ec5e6', '#ffcf5a', '#ff7aa8', '#34d399'];
    const parts = Array.from({ length: w < 640 ? 110 : 170 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 7 + Math.random() * 9;
      return {
        x: w / 2 + (Math.random() - 0.5) * 120, y: hh * 0.42,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        s: 5 + Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)], round: Math.random() < 0.3
      };
    });
    const start = performance.now();
    const duration = 2800;
    const step = (now) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, hh);
      ctx.globalAlpha = t > duration - 700 ? Math.max(0, (duration - t) / 700) : 1;
      parts.forEach((p) => {
        p.vy += 0.22; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.4, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      });
      if (t < duration) window.requestAnimationFrame(step); else canvas.remove();
    };
    window.requestAnimationFrame(step);
  }

  window.EF = Object.freeze({
    h, append, clear, icon, clamp, motionOK,
    config: loadConfig(),
    request, uid, store, format,
    currentTheme, initThemeToggle,
    onScroll, createScene, reveal, depthScroll, tilt, countUp,
    toast, dismissToasts, confetti
  });
})();
