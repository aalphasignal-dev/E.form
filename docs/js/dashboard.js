/* E.form — dashboard αποτελεσμάτων (μόνο για τον διαχειριστή). */
(function () {
  'use strict';

  const { h, icon, clear, config, format, store, clamp } = window.EF;
  const QUESTIONS = config.questions;
  const KEY_STORE = 'eform.admin.key';
  const AUTO_STORE = 'eform.admin.auto';
  const FLASH_STORE = 'eform.admin.flash';
  const IDLE_LIMIT_MS = 20 * 60 * 1000;
  const AUTO_EVERY_MS = 60 * 1000;
  const PAGE_SIZE = 20;
  const TEXT_PAGE = 8;
  const DAY = 86400000;
  const hasChart = typeof window.Chart === 'function';

  const ERRORS = {
    unauthorized: 'Λάθος κωδικός διαχειριστή.',
    locked: 'Πάρα πολλές λάθος προσπάθειες. Η πρόσβαση κλειδώθηκε προσωρινά (έως 10 λεπτά).',
    not_configured: 'Δεν έχει οριστεί ADMIN_KEY στο Apps Script. Τρέξτε μία φορά τη συνάρτηση setup().',
    network: 'Δεν ήταν δυνατή η σύνδεση με το Apps Script. Ελέγξτε το URL στο config.js και ότι η ανάπτυξη έχει πρόσβαση «Οποιοσδήποτε».',
    timeout: 'Το Apps Script αργεί να απαντήσει. Δοκιμάστε ξανά.',
    bad_response: 'Μη αναμενόμενη απάντηση. Βεβαιωθείτε ότι το URL τελειώνει σε /exec και ότι κάνατε «Νέα έκδοση» στην ανάπτυξη.',
    server_error: 'Σφάλμα μέσα στο Apps Script. Δείτε τις «Εκτελέσεις» στον editor του Apps Script.',
    default: 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.'
  };
  const messageFor = (code) => ERRORS[code] || ERRORS.default;

  const $ = (id) => document.getElementById(id);
  const els = {
    login: $('login'), loginForm: $('login-form'), keyInput: $('admin-key'), keyToggle: $('toggle-key'),
    loginBtn: $('login-btn'), loginError: $('login-error'), loginWarn: $('login-config-warning'),
    app: $('app'), updated: $('updated-at'), refresh: $('refresh-btn'), exportBtn: $('export-btn'),
    auto: $('auto-btn'), logout: $('logout-btn'), range: $('range'), kpis: $('kpis'),
    timeline: $('timeline-card'), grid: $('questions-grid'), responses: $('responses-card')
  };

  const state = {
    key: '', rows: [], extra: [], range: 'all', loading: false,
    fetchedAt: null, autoTimer: 0, lastActivity: Date.now()
  };
  const components = [];

  // ─── ΔΕΔΟΜΕΝΑ ───────────────────────────────────────────────────────────

  async function fetchData(key) {
    const res = await window.EF.request(config.scriptUrl + '?key=' + encodeURIComponent(key), { method: 'GET' });
    if (!res.ok) throw Object.assign(new Error(res.error), { code: res.error || 'default' });
    return res;
  }

  function parseValue(q, value) {
    if (value === null || value === undefined || value === '') return q.type === 'multi' ? [] : '';
    if (q.type === 'rating') { const n = Number(value); return Number.isFinite(n) ? n : ''; }
    if (q.type === 'multi') return String(value).split(';').map((s) => s.trim()).filter(Boolean);
    return String(value);
  }

  function normalize(res) {
    const headers = Array.isArray(res.headers) ? res.headers.filter((x) => typeof x === 'string' && x) : [];
    const known = new Set(['timestamp'].concat(QUESTIONS.map((q) => q.id)));
    const extra = headers.filter((x) => !known.has(x));
    const rows = (Array.isArray(res.rows) ? res.rows : []).map((r) => {
      if (!r || typeof r !== 'object') return null;
      const ts = new Date(r.timestamp);
      const values = {};
      QUESTIONS.forEach((q) => { values[q.id] = parseValue(q, r[q.id]); });
      extra.forEach((id) => { values[id] = r[id] === null || r[id] === undefined ? '' : String(r[id]); });
      return { ts: isNaN(ts.getTime()) ? null : ts, values };
    }).filter(Boolean).sort((a, b) => (b.ts ? b.ts.getTime() : 0) - (a.ts ? a.ts.getTime() : 0));
    return { rows, extra };
  }

  const isEmpty = (v) => v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  function rangeStart() {
    const today = startOfDay(new Date());
    if (state.range === 'today') return today;
    if (state.range === '7d') return addDays(today, -6);
    if (state.range === '30d') return addDays(today, -29);
    return null;
  }

  function inRange(rows) {
    const from = rangeStart();
    return from ? rows.filter((r) => r.ts && r.ts >= from) : rows;
  }

  function cellText(q, value) {
    if (Array.isArray(value)) return value.join('; ');
    if (value === '' || value === null || value === undefined) return '';
    if (q && q.type === 'rating') return String(value);
    return String(value);
  }

  // ─── CHART.JS ───────────────────────────────────────────────────────────

  function palette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    return {
      series: v('--chart-1'), seriesHover: v('--chart-1-hover'), seriesSoft: v('--chart-1-soft'),
      text: v('--text'), text2: v('--text-2'), muted: v('--muted'), grid: v('--chart-grid'),
      axis: v('--chart-axis'), surface: v('--chart-surface'), tooltip: v('--tooltip-bg'), border: v('--border-strong')
    };
  }

  if (hasChart) {
    window.Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'system-ui, sans-serif';
    window.Chart.defaults.font.size = 12;
    window.Chart.defaults.maintainAspectRatio = false;
    window.Chart.defaults.animation.duration = window.EF.motionOK() ? 850 : 0;
    window.Chart.defaults.animation.easing = 'easeOutQuart';
  }

  /** Τιμή στην άκρη κάθε μπάρας (επιλεκτική ετικέτα, κείμενο σε χρώμα κειμένου — όχι σειράς). */
  const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(chart, args, opts) {
      if (!opts || !opts.format) return;
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const data = chart.data.datasets[0].data;
      ctx.save();
      ctx.font = '600 12px ' + window.Chart.defaults.font.family;
      ctx.fillStyle = opts.color;
      meta.data.forEach((bar, i) => {
        if (!bar || bar.skip) return;
        const text = opts.format(data[i], i);
        if (opts.horizontal) {
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(text, Math.max(bar.x, bar.base) + 8, bar.y);
        } else {
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(text, bar.x, Math.min(bar.y, bar.base) - 6);
        }
      });
      ctx.restore();
    }
  };

  /** Κάθετη γραμμή που «βρίσκει» το σημείο κάτω από τον δείκτη. */
  const crosshair = {
    id: 'crosshair',
    beforeDatasetsDraw(chart, args, opts) {
      const active = chart.tooltip && chart.tooltip.getActiveElements();
      if (!active || !active.length) return;
      const x = Math.round(active[0].element.x) + 0.5;
      const { top, bottom } = chart.chartArea;
      const { ctx } = chart;
      ctx.save();
      ctx.strokeStyle = opts.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      ctx.restore();
    }
  };

  function tooltip(c, callbacks) {
    return {
      backgroundColor: c.tooltip, borderColor: c.border, borderWidth: 1,
      titleColor: c.muted, bodyColor: c.text,
      titleFont: { weight: '500', size: 12 }, bodyFont: { weight: '700', size: 14 },
      padding: { x: 12, y: 10 }, cornerRadius: 10, caretSize: 6, displayColors: false,
      callbacks
    };
  }

  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  function barConfig(d) {
    const c = palette();
    const valueAxis = d.horizontal ? 'x' : 'y';
    const catAxis = d.horizontal ? 'y' : 'x';
    const max = Math.max(1, ...d.values);
    return {
      type: 'bar',
      data: {
        labels: d.labels,
        datasets: [{
          data: d.values, backgroundColor: c.series, hoverBackgroundColor: c.seriesHover,
          borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24,
          categoryPercentage: 0.74, barPercentage: 0.92
        }]
      },
      options: {
        indexAxis: d.horizontal ? 'y' : 'x',
        layout: { padding: d.horizontal ? { right: 78, left: 2 } : { top: 26 } },
        scales: {
          [valueAxis]: { display: false, beginAtZero: true, suggestedMax: max * 1.04, grid: { display: false } },
          [catAxis]: {
            grid: { display: false }, border: { color: c.axis },
            ticks: {
              color: c.text2, font: { size: 12, weight: '500' }, padding: 6,
              // Οι ετικέτες κόβονται στο πραγματικό διαθέσιμο πλάτος (το Chart.js δίνει στον άξονα
              // έως το μισό γράφημα). Το πλήρες κείμενο υπάρχει στο tooltip και στον πίνακα.
              callback(value) {
                const label = String(this.getLabelForValue(value));
                if (!d.horizontal) return truncate(label, 14);
                const max = (this.chart.width - 80) / 2 - 16;
                const ctx = this.ctx;
                ctx.save();
                ctx.font = '500 12px ' + window.Chart.defaults.font.family;
                let text = label;
                if (ctx.measureText(text).width > max) {
                  while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
                  text = text.trimEnd() + '…';
                }
                ctx.restore();
                return text;
              }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(c, {
            title: (items) => d.fullLabels[items[0].dataIndex],
            label: (item) => d.format(item.raw, item.dataIndex)
          }),
          valueLabels: { color: c.text2, format: d.format, horizontal: d.horizontal }
        }
      },
      plugins: [valueLabels]
    };
  }

  function lineConfig(d) {
    const c = palette();
    return {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [{
          data: d.values, borderColor: c.series, backgroundColor: c.seriesSoft, fill: 'origin',
          borderWidth: 2, cubicInterpolationMode: 'monotone', borderCapStyle: 'round', borderJoinStyle: 'round',
          pointRadius: d.values.length <= 1 ? 4 : 0, pointHoverRadius: 5, pointHitRadius: 14,
          pointBackgroundColor: c.series, pointBorderColor: c.surface, pointBorderWidth: 2, pointHoverBorderWidth: 2
        }]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, border: { color: c.axis }, ticks: { color: c.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 18 } },
          y: {
            beginAtZero: true, suggestedMax: 4, grid: { color: c.grid, drawTicks: false }, border: { display: false },
            ticks: { color: c.muted, precision: 0, padding: 10, maxTicksLimit: 5 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(c, {
            title: (items) => d.fullLabels[items[0].dataIndex],
            label: (item) => format.number(item.raw) + (item.raw === 1 ? ' απάντηση' : ' απαντήσεις')
          }),
          crosshair: { color: c.axis }
        }
      },
      plugins: [crosshair]
    };
  }

  /** Ένα «κελί» γραφήματος: ενημερώνει το υπάρχον γράφημα αντί να το ξαναχτίζει. */
  function chartSlot(canvas, build) {
    let chart = null;
    let last = null;
    return {
      set(data) {
        last = data;
        if (!hasChart) return;
        const cfg = build(data);
        if (chart) {
          chart.data.labels = cfg.data.labels;
          chart.data.datasets[0].data = cfg.data.datasets[0].data;
          chart.options = cfg.options;
          chart.update();
        } else {
          chart = new window.Chart(canvas, cfg);
        }
      },
      restyle() {
        if (chart) { chart.destroy(); chart = null; }
        if (last) this.set(last);
      }
    };
  }

  function tableView(caption, columns) {
    const tbody = h('tbody');
    const details = h('details', { class: 'table-view' }, [
      h('summary', null, [icon('table'), h('span', { text: 'Προβολή ως πίνακας' })]),
      h('div', { class: 'table-scroll' }, h('table', { class: 'data-table compact' }, [
        h('caption', { class: 'sr-only', text: caption }),
        h('thead', null, h('tr', null, columns.map((col, i) => h('th', { scope: 'col', class: i ? 'num' : null, text: col })))),
        tbody
      ]))
    ]);
    if (!hasChart) details.open = true;
    return {
      el: details,
      set(rows) {
        clear(tbody);
        rows.forEach((r) => tbody.appendChild(h('tr', null, r.map((cell, i) => h(i ? 'td' : 'th', i ? { class: 'num', text: cell } : { scope: 'row', text: cell })))));
      }
    };
  }

  function chartBox(heightClass, label) {
    const canvas = h('canvas', { role: 'img', 'aria-label': label });
    const empty = h('div', { class: 'chart-empty', hidden: true }, [icon('info'), h('span', { text: 'Δεν υπάρχουν ακόμα απαντήσεις' })]);
    const box = h('div', { class: 'chart-box ' + heightClass + (hasChart ? '' : ' no-chart') }, [canvas, empty]);
    return { box, canvas, empty };
  }

  // ─── ΣΤΟΙΧΕΙΑ ΤΟΥ DASHBOARD ─────────────────────────────────────────────

  function kpiTile(opts) {
    const value = h('p', { class: 'kpi-value' + (opts.compact ? ' is-compact' : ''), text: '0' });
    const sub = h('p', { class: 'kpi-sub', text: '' });
    const el = h('article', { class: 'kpi' + (opts.hero ? ' kpi-hero' : '') }, [
      h('div', { class: 'kpi-head' }, [icon(opts.icon), h('h3', { class: 'kpi-label', text: opts.label })]),
      h('div', { class: 'kpi-body' }, [value, opts.suffix ? h('span', { class: 'kpi-suffix', text: opts.suffix }) : null]),
      sub
    ]);
    return { el, value, sub };
  }

  function buildKpis() {
    const rating = QUESTIONS.find((q) => q.type === 'rating');
    const total = kpiTile({ icon: 'users', label: 'Συνολικές απαντήσεις', hero: true });
    const avg = rating ? kpiTile({ icon: 'star', label: 'Μέση βαθμολογία', suffix: '/ ' + rating.max }) : null;
    const done = kpiTile({ icon: 'target', label: 'Ποσοστό συμπλήρωσης' });
    const last = kpiTile({ icon: 'clock', label: 'Τελευταία απάντηση', compact: true });
    [total, avg, done, last].filter(Boolean).forEach((t) => els.kpis.appendChild(t.el));

    components.push({
      update(rows) {
        const today = startOfDay(new Date());
        const todayCount = state.rows.filter((r) => r.ts && r.ts >= today).length;
        window.EF.countUp(total.value, rows.length, (n) => format.number(Math.round(n)));
        total.sub.textContent = state.range === 'all'
          ? (todayCount ? '+' + format.number(todayCount) + ' σήμερα' : 'Καμία σήμερα')
          : 'από ' + format.number(state.rows.length) + ' συνολικά';

        if (avg) {
          const nums = rows.map((r) => r.values[rating.id]).filter((v) => typeof v === 'number');
          const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          if (nums.length) window.EF.countUp(avg.value, mean, (n) => format.decimal(n));
          else { avg.value.textContent = '—'; avg.value.dataset.value = '0'; }
          avg.sub.textContent = nums.length ? 'από ' + format.number(nums.length) + (nums.length === 1 ? ' βαθμολογία' : ' βαθμολογίες') : 'Δεν υπάρχουν βαθμολογίες';
          avg.el.title = rating.label;
        }

        const ratio = rows.length && QUESTIONS.length
          ? rows.reduce((sum, r) => sum + QUESTIONS.filter((q) => !isEmpty(r.values[q.id])).length / QUESTIONS.length, 0) / rows.length
          : 0;
        window.EF.countUp(done.value, ratio * 100, (n) => format.number(Math.round(n)) + '%');
        done.sub.textContent = 'των ερωτήσεων απαντήθηκαν κατά μέσο όρο';

        const newest = rows.find((r) => r.ts);
        last.value.textContent = newest ? format.relative(newest.ts) : '—';
        last.sub.textContent = newest ? format.dateTime(newest.ts) : 'Δεν υπάρχουν απαντήσεις';
      }
    });
  }

  function timelineData(rows) {
    const now = new Date();
    const labels = []; const fullLabels = []; const values = [];
    if (state.range === 'today') {
      const today = startOfDay(now);
      for (let hr = 0; hr < 24; hr++) {
        labels.push(String(hr).padStart(2, '0') + ':00');
        fullLabels.push('Σήμερα, ' + String(hr).padStart(2, '0') + ':00–' + String(hr).padStart(2, '0') + ':59');
        values.push(0);
      }
      rows.forEach((r) => { if (r.ts && r.ts >= today) values[r.ts.getHours()]++; });
      return { labels, fullLabels, values, unit: 'ώρα' };
    }

    const today = startOfDay(now);
    let days = state.range === '7d' ? 7 : state.range === '30d' ? 30 : 14;
    if (state.range === 'all') {
      const oldest = rows.reduce((min, r) => (r.ts && r.ts < min ? r.ts : min), now);
      days = clamp(Math.round((today - startOfDay(oldest)) / DAY) + 1, 14, 3650);
    }
    const weekly = days > 120;
    const step = weekly ? 7 : 1;
    const buckets = Math.ceil(days / step);
    const first = addDays(today, -(buckets * step - 1));
    for (let i = 0; i < buckets; i++) {
      const start = addDays(first, i * step);
      labels.push(format.day(start));
      fullLabels.push(weekly ? 'Εβδομάδα από ' + format.day(start) : new Intl.DateTimeFormat('el-GR', { weekday: 'long', day: 'numeric', month: 'long' }).format(start));
      values.push(0);
    }
    rows.forEach((r) => {
      if (!r.ts) return;
      const idx = Math.floor((startOfDay(r.ts) - first) / DAY / step);
      if (idx >= 0 && idx < buckets) values[idx]++;
    });
    return { labels, fullLabels, values, unit: weekly ? 'εβδομάδα' : 'ημέρα' };
  }

  function buildTimeline() {
    const sub = h('p', { class: 'card-sub', text: '' });
    const peak = h('p', { class: 'card-insight', text: '' });
    const { box, canvas, empty } = chartBox('h-timeline', 'Απαντήσεις ανά ημέρα');
    const table = tableView('Απαντήσεις ανά περίοδο', ['Περίοδος', 'Απαντήσεις']);
    clear(els.timeline).append(
      h('header', { class: 'card-head' }, [
        h('div', null, [h('h2', { class: 'card-title' }, [icon('activity'), h('span', { text: 'Απαντήσεις στον χρόνο' })]), sub]),
        peak
      ]),
      box, table.el
    );
    const slot = chartSlot(canvas, lineConfig);
    components.push({
      update(rows) {
        const d = timelineData(rows);
        slot.set(d);
        const total = d.values.reduce((a, b) => a + b, 0);
        empty.hidden = total > 0;
        box.classList.toggle('is-empty', total === 0);
        sub.textContent = 'Ανά ' + d.unit + ' · ' + format.number(total) + (total === 1 ? ' απάντηση' : ' απαντήσεις');
        const maxV = Math.max(...d.values);
        peak.textContent = maxV > 0 ? 'Κορυφή: ' + format.number(maxV) + ' · ' + d.fullLabels[d.values.indexOf(maxV)] : '';
        canvas.setAttribute('aria-label', 'Γράφημα απαντήσεων ανά ' + d.unit + '. Σύνολο ' + total + '.');
        table.set(d.fullLabels.map((l, i) => [l, format.number(d.values[i])]).filter((r, i) => d.values[i] > 0 || d.values.length <= 31));
      },
      restyle: () => slot.restyle()
    });
  }

  function cardHead(q, index, chip) {
    const sub = h('p', { class: 'card-sub', text: '' });
    const head = h('header', { class: 'card-head' }, [
      h('div', { class: 'card-head-main' }, [
        h('span', { class: 'q-num small', 'aria-hidden': 'true', text: String(index + 1).padStart(2, '0') }),
        h('div', null, [h('h2', { class: 'card-title', text: q.label }), sub])
      ]),
      h('span', { class: 'chip', text: chip })
    ]);
    return { head, sub };
  }

  function buildChoiceCard(q, index) {
    const multi = q.type === 'multi';
    const { head, sub } = cardHead(q, index, multi ? 'Πολλαπλή επιλογή' : 'Επιλογή');
    const insight = h('p', { class: 'card-insight', text: '' });
    const { box, canvas, empty } = chartBox('h-auto', q.label);
    const table = tableView(q.label, ['Επιλογή', 'Απαντήσεις', 'Ποσοστό']);
    const card = h('article', { class: 'card q-result reveal' }, [head, insight, box, table.el]);
    els.grid.appendChild(card);
    const slot = chartSlot(canvas, barConfig);

    components.push({
      update(rows) {
        const answered = rows.filter((r) => !isEmpty(r.values[q.id]));
        const counts = new Map(q.options.map((o) => [o, 0]));
        answered.forEach((r) => {
          const vals = multi ? r.values[q.id] : [r.values[q.id]];
          vals.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
        });
        const labels = Array.from(counts.keys());
        const values = labels.map((l) => counts.get(l));
        const n = answered.length;
        const pct = (v) => (n ? v / n : 0);
        box.style.setProperty('--bars', String(labels.length));
        slot.set({
          labels, fullLabels: labels, values, horizontal: true,
          format: (v) => format.number(v) + ' · ' + format.percent(pct(v))
        });
        empty.hidden = n > 0;
        box.classList.toggle('is-empty', n === 0);
        sub.textContent = format.number(n) + (n === 1 ? ' απάντηση' : ' απαντήσεις') + (multi ? ' · ποσοστό επί των ατόμων' : '');
        const maxV = Math.max(0, ...values);
        insight.textContent = n ? 'Πιο συχνή: «' + labels[values.indexOf(maxV)] + '» με ' + format.percent(pct(maxV)) : '';
        canvas.setAttribute('aria-label', q.label + '. ' + labels.map((l, i) => l + ': ' + values[i]).join(', '));
        table.set(labels.map((l, i) => [l, format.number(values[i]), format.percent(pct(values[i]))]));
      },
      restyle: () => slot.restyle()
    });
  }

  function buildRatingCard(q, index) {
    const { head, sub } = cardHead(q, index, 'Βαθμολογία');
    const avgValue = h('span', { class: 'score-value', text: '—' });
    // Λεπτή μπάρα: γέμισμα = μέσος όρος πάνω στην κλίμακα, πάνω σε ανοιχτότερη απόχρωση του ίδιου χρώματος.
    const meter = h('span', { class: 'meter', 'aria-hidden': 'true' }, h('span', { class: 'meter-fill' }));
    const scoreNote = h('span', { class: 'score-note', text: '' });
    const summary = h('div', { class: 'score' }, [
      h('div', { class: 'score-main' }, [avgValue, h('span', { class: 'score-max', text: '/ ' + q.max })]),
      h('div', { class: 'score-side' }, [meter, scoreNote])
    ]);
    const { box, canvas, empty } = chartBox('h-rating', q.label);
    const table = tableView(q.label, ['Βαθμός', 'Απαντήσεις', 'Ποσοστό']);
    const card = h('article', { class: 'card q-result reveal' }, [head, summary, box, table.el]);
    els.grid.appendChild(card);
    const slot = chartSlot(canvas, barConfig);

    components.push({
      update(rows) {
        const nums = rows.map((r) => r.values[q.id]).filter((v) => typeof v === 'number');
        const n = nums.length;
        const levels = [];
        for (let v = q.min; v <= q.max; v++) levels.push(v);
        const values = levels.map((lv) => nums.filter((x) => Math.round(x) === lv).length);
        const mean = n ? nums.reduce((a, b) => a + b, 0) / n : 0;
        const label = (lv) => String(lv);
        const full = (lv) => lv + ' / ' + q.max + (q.labels[lv - q.min] ? ' — ' + q.labels[lv - q.min] : '');
        slot.set({
          labels: levels.map(label), fullLabels: levels.map(full), values, horizontal: false,
          format: (v) => format.number(v)
        });
        empty.hidden = n > 0;
        box.classList.toggle('is-empty', n === 0);

        if (n) window.EF.countUp(avgValue, mean, (x) => format.decimal(x));
        else { avgValue.textContent = '—'; avgValue.dataset.value = '0'; }
        const fraction = n ? clamp((mean - q.min) / (q.max - q.min), 0, 1) : 0;
        meter.style.setProperty('--fill', (fraction * 100).toFixed(1) + '%');
        sub.textContent = format.number(n) + (n === 1 ? ' βαθμολογία' : ' βαθμολογίες');

        if (!n) scoreNote.textContent = 'Μέσος όρος';
        else if (q.min === 0 && q.max === 10) {
          const promoters = nums.filter((x) => x >= 9).length / n;
          const detractors = nums.filter((x) => x <= 6).length / n;
          scoreNote.textContent = 'NPS ' + Math.round((promoters - detractors) * 100);
        } else {
          const topBand = nums.filter((x) => x >= q.max - 1).length / n;
          scoreNote.textContent = format.percent(topBand) + ' θετικές (' + (q.max - 1) + '–' + q.max + ')';
        }
        canvas.setAttribute('aria-label', q.label + '. Μέσος όρος ' + format.decimal(mean) + '. ' + levels.map((lv, i) => lv + ': ' + values[i]).join(', '));
        table.set(levels.map((lv, i) => [full(lv), format.number(values[i]), format.percent(n ? values[i] / n : 0)]));
      },
      restyle: () => slot.restyle()
    });
  }

  function buildTextCard(q, index) {
    const { head, sub } = cardHead(q, index, 'Ελεύθερο κείμενο');
    const search = h('input', { class: 'search-input', type: 'search', placeholder: 'Αναζήτηση στις απαντήσεις…', 'aria-label': 'Αναζήτηση στις απαντήσεις: ' + q.label, autocomplete: 'off' });
    const tbody = h('tbody');
    const more = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', hidden: true, text: 'Εμφάνιση περισσότερων' });
    const emptyNote = h('p', { class: 'list-empty', hidden: true, text: 'Δεν υπάρχουν απαντήσεις κειμένου.' });
    const card = h('article', { class: 'card q-result is-wide reveal' }, [
      head,
      h('div', { class: 'search' }, [icon('search'), search]),
      h('div', { class: 'table-scroll' }, h('table', { class: 'data-table text-table' }, [
        h('caption', { class: 'sr-only', text: q.label }),
        h('thead', null, h('tr', null, [h('th', { scope: 'col', class: 'col-date', text: 'Ημερομηνία' }), h('th', { scope: 'col', text: 'Απάντηση' })])),
        tbody
      ])),
      emptyNote,
      h('div', { class: 'card-foot' }, more)
    ]);
    els.grid.appendChild(card);

    let limit = TEXT_PAGE;
    let current = [];
    const paint = () => {
      const term = search.value.trim().toLocaleLowerCase('el');
      const list = term ? current.filter((r) => String(r.values[q.id]).toLocaleLowerCase('el').indexOf(term) !== -1) : current;
      clear(tbody);
      list.slice(0, limit).forEach((r) => {
        tbody.appendChild(h('tr', null, [
          h('td', { class: 'col-date', text: r.ts ? format.dateTime(r.ts) : '—' }),
          h('td', { class: 'col-text', text: String(r.values[q.id]) })
        ]));
      });
      more.hidden = list.length <= limit;
      more.textContent = 'Εμφάνιση περισσότερων (' + format.number(list.length - limit) + ')';
      emptyNote.hidden = list.length > 0;
      emptyNote.textContent = term ? 'Καμία απάντηση δεν ταιριάζει με την αναζήτηση.' : 'Δεν υπάρχουν απαντήσεις κειμένου.';
    };
    search.addEventListener('input', () => { limit = TEXT_PAGE; paint(); });
    more.addEventListener('click', () => { limit += TEXT_PAGE * 2; paint(); });

    components.push({
      update(rows) {
        current = rows.filter((r) => !isEmpty(r.values[q.id]));
        sub.textContent = format.number(current.length) + (current.length === 1 ? ' απάντηση' : ' απαντήσεις') +
          (rows.length ? ' · ' + format.percent(current.length / rows.length) + ' των συμμετεχόντων' : '');
        paint();
      }
    });
  }

  function buildResponsesTable() {
    const columns = [{ id: 'timestamp', label: 'Ημερομηνία' }]
      .concat(QUESTIONS.map((q) => ({ id: q.id, label: q.label, q })))
      .concat(state.extra.map((id) => ({ id, label: id })));
    const search = h('input', { class: 'search-input', type: 'search', placeholder: 'Αναζήτηση σε όλες τις απαντήσεις…', 'aria-label': 'Αναζήτηση σε όλες τις απαντήσεις', autocomplete: 'off' });
    const count = h('p', { class: 'card-sub', text: '' });
    const tbody = h('tbody');
    const prev = h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Προηγούμενη σελίδα' }, icon('chevronLeft'));
    const next = h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Επόμενη σελίδα' }, icon('chevronRight'));
    const pageInfo = h('span', { class: 'pager-info', text: '' });
    clear(els.responses).append(
      h('header', { class: 'card-head' }, [
        h('div', null, [h('h2', { class: 'card-title' }, [icon('table'), h('span', { text: 'Όλες οι απαντήσεις' })]), count]),
        h('div', { class: 'search' }, [icon('search'), search])
      ]),
      h('div', { class: 'table-scroll' }, h('table', { class: 'data-table responses-table' }, [
        h('caption', { class: 'sr-only', text: 'Όλες οι απαντήσεις' }),
        h('thead', null, h('tr', null, columns.map((col) => h('th', { scope: 'col', title: col.label, text: truncate(col.label, 32) })))),
        tbody
      ])),
      h('div', { class: 'card-foot pager' }, [prev, pageInfo, next])
    );

    let page = 1;
    let current = [];
    const paint = () => {
      const term = search.value.trim().toLocaleLowerCase('el');
      const list = term
        ? current.filter((r) => columns.some((col) => (col.id === 'timestamp' ? '' : cellText(col.q, r.values[col.id])).toLocaleLowerCase('el').indexOf(term) !== -1))
        : current;
      const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      page = clamp(page, 1, pages);
      clear(tbody);
      list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).forEach((r) => {
        tbody.appendChild(h('tr', null, columns.map((col) => {
          if (col.id === 'timestamp') return h('td', { class: 'col-date', text: r.ts ? format.dateTime(r.ts) : '—' });
          const text = cellText(col.q, r.values[col.id]);
          return h('td', { class: text ? (col.q && col.q.type === 'rating' ? 'num' : '') : 'is-blank', text: text || '—' });
        })));
      });
      if (!list.length) {
        tbody.appendChild(h('tr', null, h('td', { class: 'list-empty', colspan: columns.length, text: term ? 'Καμία απάντηση δεν ταιριάζει.' : 'Δεν υπάρχουν απαντήσεις ακόμα.' })));
      }
      pageInfo.textContent = 'Σελίδα ' + page + ' από ' + pages;
      prev.disabled = page <= 1;
      next.disabled = page >= pages;
      count.textContent = format.number(list.length) + (list.length === 1 ? ' εγγραφή' : ' εγγραφές');
    };
    search.addEventListener('input', () => { page = 1; paint(); });
    prev.addEventListener('click', () => { page--; paint(); });
    next.addEventListener('click', () => { page++; paint(); });

    components.push({ update(rows) { current = rows; paint(); } });
  }

  // ─── ΕΞΑΓΩΓΗ CSV ────────────────────────────────────────────────────────

  function exportCsv() {
    const rows = inRange(state.rows);
    if (!rows.length) { window.EF.toast('Δεν υπάρχουν απαντήσεις για εξαγωγή.', { type: 'info' }); return; }
    const cols = [{ id: 'timestamp', label: 'Ημερομηνία' }]
      .concat(QUESTIONS.map((q) => ({ id: q.id, label: q.label, q })))
      .concat(state.extra.map((id) => ({ id, label: id })));
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    const escape = (value) => {
      let s = value === null || value === undefined ? '' : String(value);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // προστασία από formula injection στο Excel
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [cols.map((c) => escape(c.label)).join(',')];
    rows.forEach((r) => {
      lines.push(cols.map((c) => escape(c.id === 'timestamp' ? (r.ts ? stamp(r.ts) : '') : cellText(c.q, r.values[c.id]))).join(','));
    });
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const a = h('a', { href: url, download: 'apantiseis-' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '.csv' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    window.EF.toast('Έγινε εξαγωγή ' + format.number(rows.length) + ' απαντήσεων σε CSV.', { type: 'success' });
  }

  // ─── ΡΟΗ ΕΦΑΡΜΟΓΗΣ ──────────────────────────────────────────────────────

  let built = false;
  function buildApp() {
    if (built) return;
    built = true;
    buildKpis();
    buildTimeline();
    QUESTIONS.forEach((q, i) => {
      if (q.type === 'choice' || q.type === 'multi') buildChoiceCard(q, i);
      else if (q.type === 'rating') buildRatingCard(q, i);
      else buildTextCard(q, i);
    });
    buildResponsesTable();
    window.EF.reveal(els.app.querySelectorAll('.reveal'));
  }

  function render() {
    const rows = inRange(state.rows);
    components.forEach((c) => c.update(rows));
    paintUpdated();
  }

  function applyData(res) {
    const before = state.rows.length;
    const next = normalize(res);
    const firstLoad = !built;
    state.rows = next.rows;
    state.extra = next.extra;
    state.fetchedAt = new Date();
    buildApp();
    render();
    return firstLoad ? 0 : next.rows.length - before;
  }

  function paintUpdated() {
    if (!state.fetchedAt) return;
    els.updated.textContent = 'Ενημέρωση ' + format.time(state.fetchedAt) + ' · ' + format.relative(state.fetchedAt);
  }

  function showApp() {
    els.login.hidden = true;
    els.app.hidden = false;
    document.documentElement.classList.add('is-authed');
  }

  function setLoginBusy(busy) {
    els.loginBtn.disabled = busy;
    els.keyInput.disabled = busy;
    els.loginBtn.classList.toggle('is-loading', busy);
    els.loginBtn.setAttribute('aria-busy', String(busy));
  }

  function showLoginError(message) {
    clear(els.loginError);
    if (!message) { els.loginError.hidden = true; return; }
    els.loginError.append(icon('alert'), h('span', { text: message }));
    els.loginError.hidden = false;
    const card = els.login.querySelector('.login-card');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }

  async function login(key) {
    if (!config.configured) { showLoginError('Το config.js δεν έχει ακόμα το URL του Apps Script.'); return; }
    showLoginError('');
    setLoginBusy(true);
    try {
      const res = await fetchData(key);
      state.key = key;
      store.set('sessionStorage', KEY_STORE, key);
      els.keyInput.value = '';
      showApp();
      applyData(res);
      startTimers();
    } catch (err) {
      store.remove('sessionStorage', KEY_STORE);
      showLoginError(messageFor(err && err.code));
      els.keyInput.select();
    } finally {
      setLoginBusy(false);
      if (!els.login.hidden) els.keyInput.focus();
    }
  }

  async function refresh(quiet) {
    if (state.loading || !state.key) return;
    state.loading = true;
    els.app.classList.add('is-refreshing');
    els.refresh.classList.add('is-spinning');
    els.refresh.disabled = true;
    try {
      const res = await fetchData(state.key);
      const added = applyData(res);
      if (added > 0) window.EF.toast('+' + format.number(added) + (added === 1 ? ' νέα απάντηση' : ' νέες απαντήσεις'), { type: 'success' });
      else if (!quiet) window.EF.toast('Τα δεδομένα είναι ενημερωμένα.', { type: 'info', timeout: 2200 });
    } catch (err) {
      const code = err && err.code;
      if (code === 'unauthorized' || code === 'locked' || code === 'not_configured') logout(messageFor(code));
      else window.EF.toast(messageFor(code), { type: 'error' });
    } finally {
      state.loading = false;
      els.app.classList.remove('is-refreshing');
      els.refresh.classList.remove('is-spinning');
      els.refresh.disabled = false;
    }
  }

  /** Αποσύνδεση = διαγραφή κωδικού + πλήρες reload ώστε να μη μείνει τίποτα στη μνήμη. */
  function logout(message) {
    store.remove('sessionStorage', KEY_STORE);
    if (message) store.set('sessionStorage', FLASH_STORE, message);
    state.key = '';
    state.rows = [];
    window.location.replace(window.location.pathname);
  }

  function paintAuto() {
    els.auto.classList.toggle('is-on', state.auto);
    els.auto.setAttribute('aria-pressed', String(state.auto));
    els.auto.title = state.auto ? 'Αυτόματη ανανέωση κάθε 60″: ενεργή' : 'Αυτόματη ανανέωση: ανενεργή';
  }

  let timersStarted = false;
  function startTimers() {
    if (timersStarted) return;
    timersStarted = true;
    // Ζωντανή ενημέρωση του «πριν από…», αυτόματη αποσύνδεση και αυτόματη ανανέωση.
    setInterval(() => {
      paintUpdated();
      if (Date.now() - state.lastActivity > IDLE_LIMIT_MS) logout('Αποσυνδεθήκατε αυτόματα λόγω αδράνειας.');
    }, 30000);
    state.autoTimer = setInterval(() => {
      if (state.auto && !document.hidden) refresh(true);
    }, AUTO_EVERY_MS);
  }

  function init() {
    window.EF.initThemeToggle(document.getElementById('theme-toggle'));
    document.title = 'Dashboard · ' + config.survey.brand;
    document.querySelectorAll('[data-brand-name]').forEach((el) => { el.textContent = config.survey.brand; });
    if (config.survey.logo) {
      const mark = document.querySelector('#app .brand-mark');
      if (mark) mark.replaceWith(h('img', { class: 'brand-logo', src: config.survey.logo, alt: '' }));
    }

    if (!config.configured) els.loginWarn.hidden = false;
    if (!hasChart) console.warn('[E.form] Το Chart.js δεν φορτώθηκε — εμφανίζονται μόνο πίνακες.');

    const flash = store.get('sessionStorage', FLASH_STORE);
    if (flash) {
      store.remove('sessionStorage', FLASH_STORE);
      showLoginError(flash);
    }

    els.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const key = els.keyInput.value.trim();
      if (!key) { showLoginError('Γράψτε τον κωδικό διαχειριστή.'); els.keyInput.focus(); return; }
      login(key);
    });
    els.keyToggle.addEventListener('click', () => {
      const show = els.keyInput.type === 'password';
      els.keyInput.type = show ? 'text' : 'password';
      clear(els.keyToggle).appendChild(icon(show ? 'eyeOff' : 'eye'));
      els.keyToggle.setAttribute('aria-label', show ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού');
      els.keyToggle.setAttribute('aria-pressed', String(show));
      els.keyInput.focus();
    });

    els.refresh.addEventListener('click', () => refresh(false));
    els.exportBtn.addEventListener('click', exportCsv);
    els.logout.addEventListener('click', () => logout('Αποσυνδεθήκατε.'));
    state.auto = store.get('sessionStorage', AUTO_STORE) === '1';
    paintAuto();
    els.auto.addEventListener('click', () => {
      state.auto = !state.auto;
      store.set('sessionStorage', AUTO_STORE, state.auto ? '1' : '0');
      paintAuto();
      window.EF.toast(state.auto ? 'Αυτόματη ανανέωση κάθε 60 δευτερόλεπτα.' : 'Η αυτόματη ανανέωση σταμάτησε.', { type: 'info', timeout: 2500 });
      if (state.auto) refresh(true);
    });

    els.range.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-range]');
      if (!btn || btn.dataset.range === state.range) return;
      state.range = btn.dataset.range;
      els.range.querySelectorAll('[data-range]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      els.range.style.setProperty('--seg-index', String(Array.from(els.range.querySelectorAll('[data-range]')).indexOf(btn)));
      render();
    });

    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => {
      window.addEventListener(ev, () => { state.lastActivity = Date.now(); }, { passive: true });
    });
    window.addEventListener('eform:theme', () => components.forEach((c) => c.restyle && c.restyle()));

    const saved = store.get('sessionStorage', KEY_STORE);
    if (saved && config.configured) login(saved);
    else els.keyInput.focus();
    document.documentElement.classList.add('is-ready');
  }

  init();
})();
