/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  E.form — Backend (Google Apps Script + Google Sheet)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  doPost(e) → αποθηκεύει μία απάντηση της φόρμας ως νέα γραμμή στο Sheet.
 *  doGet(e)  → επιστρέφει όλες τις απαντήσεις σε JSON, ΜΟΝΟ με σωστό ?key=.
 *
 *  🔐 ΑΣΦΑΛΕΙΑ — ΔΙΑΒΑΣΤΕ ΠΡΩΤΑ
 *  ─────────────────────────────
 *  Ο κωδικός διαχειριστή (ADMIN_KEY) ΔΕΝ γράφεται μέσα σε αυτό το αρχείο.
 *  Αυτό το αρχείο υπάρχει και στο GitHub, όπου μπορεί να το δει οποιοσδήποτε.
 *
 *  Ο κωδικός αποθηκεύεται στις «Ιδιότητες σεναρίου» (Script Properties) του
 *  Apps Script, που λειτουργούν όπως ένα αρχείο .env: τις βλέπει μόνο ο
 *  ιδιοκτήτης του project και δεν ανεβαίνουν ποτέ στο GitHub.
 *
 *  Δύο τρόποι για να τον ορίσετε:
 *    α) Εύκολος: επιλέξτε τη συνάρτηση  setup  πάνω στη γραμμή εργαλείων και
 *       πατήστε «Εκτέλεση». Δημιουργεί έναν τυχαίο ισχυρό κωδικό και τον
 *       εμφανίζει στο «Αρχείο καταγραφής εκτέλεσης».
 *    β) Χειροκίνητος: ⚙️ Ρυθμίσεις έργου → Ιδιότητες σεναρίου →
 *       Προσθήκη ιδιότητας → Ιδιότητα: ADMIN_KEY, Τιμή: <κωδικός ≥ 16 χαρακτήρες>
 */

// ─── ΡΥΘΜΙΣΕΙΣ ──────────────────────────────────────────────────────────────

/**
 * ADMIN_KEY: εδώ ορίζεται ΜΟΝΟ το ΟΝΟΜΑ της ιδιότητας σεναρίου που κρατά τον
 * κωδικό — όχι ο ίδιος ο κωδικός. ΜΗΝ γράψετε τον κωδικό σας σε αυτή τη γραμμή.
 */
const ADMIN_KEY_PROPERTY = 'ADMIN_KEY';

/** Το φύλλο (καρτέλα) του Google Sheet όπου γράφονται οι απαντήσεις. */
const SHEET_NAME = 'Απαντήσεις';

/**
 * ΠΡΟΑΙΡΕΤΙΚΟ (επιπλέον ασφάλεια): αν γράψετε εδώ τα id των ερωτήσεων από το
 * config.js, π.χ. ['source', 'satisfaction', 'improve'], ο server θα απορρίπτει
 * οποιοδήποτε άλλο πεδίο. Αν το αφήσετε κενό, δέχεται κάθε έγκυρο id και
 * δημιουργεί αυτόματα τις στήλες που λείπουν.
 */
const ALLOWED_FIELDS = [];

/** Όρια ελέγχου εισόδου. */
const LIMITS = Object.freeze({
  maxBodyChars: 20000,      // μέγιστο μέγεθος αιτήματος (χαρακτήρες)
  maxFields: 40,            // μέγιστος αριθμός ερωτήσεων / στηλών
  maxValueChars: 2000,      // μέγιστο μήκος μίας απάντησης
  maxArrayItems: 25,        // μέγιστες επιλογές σε ερώτηση πολλαπλής επιλογής
  minFillMs: 1500,          // πιο γρήγορη συμπλήρωση = πιθανότατα bot
  postsPerMinute: 60,       // όριο υποβολών ανά λεπτό (για όλη τη φόρμα)
  minKeyLength: 16,         // ελάχιστο μήκος ADMIN_KEY
  authFailsBeforeLock: 20,  // αποτυχημένες συνδέσεις πριν το προσωρινό κλείδωμα
  lockSeconds: 600,         // διάρκεια κλειδώματος (δευτερόλεπτα)
  dedupeSeconds: 21600      // πόσο θυμάται ένα id υποβολής (κατά των διπλοεγγραφών)
});

const TIMESTAMP_HEADER = 'timestamp';
const FIELD_ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const SUBMISSION_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// ─── ENDPOINTS ──────────────────────────────────────────────────────────────

/**
 * Δέχεται μία υποβολή της φόρμας.
 * Σώμα (text/plain, JSON): { "answers": { "<id>": <τιμή>, ... }, "meta": { ... } }
 */
function doPost(e) {
  try {
    const body = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '';
    if (!body.trim()) return reply_({ ok: false, error: 'empty' });
    if (body.length > LIMITS.maxBodyChars) return reply_({ ok: false, error: 'too_large' });

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (_) {
      return reply_({ ok: false, error: 'invalid_json' });
    }

    const submission = validateSubmission_(payload);

    // Τα bots παίρνουν «επιτυχία» για να μη μάθουν τι τα πρόδωσε — δεν αποθηκεύεται τίποτα.
    if (submission.isBot) return reply_({ ok: true });

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return reply_({ ok: false, error: 'busy' });
    try {
      if (submission.sid && isDuplicate_(submission.sid)) return reply_({ ok: true, duplicate: true });
      if (!withinRateLimit_()) return reply_({ ok: false, error: 'rate_limited' });

      appendAnswers_(submission.answers);
      SpreadsheetApp.flush();
      if (submission.sid) rememberSubmission_(submission.sid);
    } finally {
      lock.releaseLock();
    }

    return reply_({ ok: true });
  } catch (err) {
    return handleError_(err, 'doPost');
  }
}

/**
 * Επιστρέφει όλες τις απαντήσεις — μόνο αν το ?key= ταιριάζει με τον ADMIN_KEY.
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const auth = checkAdminKey_(params.key);
    if (!auth.ok) return reply_({ ok: false, error: auth.error });

    const data = readAll_();
    return reply_({
      ok: true,
      count: data.rows.length,
      headers: data.headers,
      rows: data.rows,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    return handleError_(err, 'doGet');
  }
}

// ─── ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΓΙΑ ΤΟΝ ΙΔΙΟΚΤΗΤΗ (εκτελούνται από τον editor) ───

/**
 * Τρέξτε τη μία φορά μετά την επικόλληση του κώδικα:
 *  • ζητά τις απαραίτητες άδειες,
 *  • δημιουργεί την καρτέλα «Απαντήσεις»,
 *  • δημιουργεί ADMIN_KEY αν δεν υπάρχει και τον εμφανίζει στο log.
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty(ADMIN_KEY_PROPERTY);

  if (!key) {
    key = generateKey_();
    props.setProperty(ADMIN_KEY_PROPERTY, key);
    Logger.log('✅ Δημιουργήθηκε νέος ADMIN_KEY. Αντιγράψτε τον και φυλάξτε τον κάπου ασφαλές:');
    Logger.log(key);
  } else if (key.length < LIMITS.minKeyLength) {
    Logger.log('⚠️ Ο ADMIN_KEY είναι πολύ μικρός (' + key.length + ' χαρακτήρες). Χρειάζονται τουλάχιστον ' +
      LIMITS.minKeyLength + '. Τρέξτε rotateAdminKey() ή αλλάξτε τον στις Ιδιότητες σεναρίου.');
  } else {
    Logger.log('ℹ️ Υπάρχει ήδη ADMIN_KEY (' + key.length + ' χαρακτήρες). Δεν άλλαξε τίποτα.');
  }

  const sheet = getSheet_();
  if (ALLOWED_FIELDS.length && readHeaders_(sheet).length === 0) {
    writeHeaders_(sheet, [TIMESTAMP_HEADER].concat(ALLOWED_FIELDS));
    Logger.log('✅ Δημιουργήθηκαν οι επικεφαλίδες: ' + ALLOWED_FIELDS.join(', '));
  }
  Logger.log('✅ Η καρτέλα «' + SHEET_NAME + '» είναι έτοιμη.');
}

/** Δημιουργεί ΝΕΟ τυχαίο ADMIN_KEY (π.χ. αν φοβάστε ότι διέρρευσε ο παλιός). */
function rotateAdminKey() {
  const key = generateKey_();
  PropertiesService.getScriptProperties().setProperty(ADMIN_KEY_PROPERTY, key);
  CacheService.getScriptCache().remove('auth_fails');
  Logger.log('🔁 Νέος ADMIN_KEY (ο παλιός δεν ισχύει πια):');
  Logger.log(key);
}

/** Ξεκλειδώνει το dashboard αν κλειδώθηκε από πολλές λάθος προσπάθειες. */
function unlockDashboard() {
  CacheService.getScriptCache().remove('auth_fails');
  Logger.log('🔓 Το κλείδωμα αφαιρέθηκε.');
}

// ─── ΕΛΕΓΧΟΣ ΕΙΣΟΔΟΥ ────────────────────────────────────────────────────────

function validateSubmission_(payload) {
  if (!isPlainObject_(payload) || !isPlainObject_(payload.answers)) throw clientError_('invalid_payload');

  const meta = isPlainObject_(payload.meta) ? payload.meta : {};
  const honeypotFilled = typeof meta.hp === 'string' && meta.hp.trim() !== '';
  const tooFast = typeof meta.elapsed === 'number' && meta.elapsed >= 0 && meta.elapsed < LIMITS.minFillMs;

  const keys = Object.keys(payload.answers);
  if (keys.length === 0) throw clientError_('empty');
  if (keys.length > LIMITS.maxFields) throw clientError_('too_many_fields');

  const answers = {};
  let filled = 0;
  keys.forEach(function (key) {
    if (!FIELD_ID_RE.test(key) || key === TIMESTAMP_HEADER) throw clientError_('invalid_field');
    if (ALLOWED_FIELDS.length && ALLOWED_FIELDS.indexOf(key) === -1) throw clientError_('invalid_field');
    const value = normalizeValue_(payload.answers[key]);
    if (value !== '') filled++;
    answers[key] = value;
  });
  if (filled === 0) throw clientError_('empty');

  return {
    answers: answers,
    isBot: honeypotFilled || tooFast,
    sid: typeof meta.sid === 'string' && SUBMISSION_ID_RE.test(meta.sid) ? meta.sid : ''
  };
}

function normalizeValue_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!isFinite(value) || Math.abs(value) > 1e9) throw clientError_('invalid_value');
    return value;
  }
  if (typeof value === 'boolean') return value ? 'Ναι' : 'Όχι';
  if (typeof value === 'string') return cleanText_(value);
  if (Array.isArray(value)) {
    if (value.length > LIMITS.maxArrayItems) throw clientError_('too_large');
    const parts = value.map(function (item) {
      if (typeof item !== 'string' && typeof item !== 'number') throw clientError_('invalid_value');
      return cleanText_(String(item)).replace(/;/g, ',');
    }).filter(function (item) { return item !== ''; });
    const joined = parts.join('; ');
    if (joined.length > LIMITS.maxValueChars) throw clientError_('too_large');
    return joined;
  }
  throw clientError_('invalid_value');
}

function cleanText_(text) {
  const cleaned = String(text)
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .trim();
  if (cleaned.length > LIMITS.maxValueChars) throw clientError_('too_large');
  return cleaned;
}

/**
 * Προστασία από «formula injection»: κείμενο που ξεκινά με = + - @ θα το
 * εκτελούσε το Google Sheets ως τύπο (π.χ. =IMPORTXML(...) που στέλνει δεδομένα
 * έξω). Η αρχική απόστροφος το κάνει απλό κείμενο και δεν φαίνεται στο κελί.
 */
function toCell_(value) {
  if (typeof value === 'number') return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

// ─── SHEET ──────────────────────────────────────────────────────────────────

function getSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const ss = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Δεν βρέθηκε Google Sheet. Δημιουργήστε το script από το Sheet (Επεκτάσεις → Apps Script) ' +
      'ή ορίστε την ιδιότητα SPREADSHEET_ID.');
  }
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function readHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1 || sheet.getLastRow() < 1) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  while (headers.length && headers[headers.length - 1] === '') headers.pop();
  return headers;
}

function writeHeaders_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function appendAnswers_(answers) {
  const sheet = getSheet_();
  let headers = readHeaders_(sheet);
  if (headers.length === 0) headers = [TIMESTAMP_HEADER];

  const missing = Object.keys(answers).filter(function (key) { return headers.indexOf(key) === -1; });
  if (missing.length || sheet.getLastRow() === 0) {
    if (headers.length + missing.length > LIMITS.maxFields + 1) throw clientError_('too_many_fields');
    headers = headers.concat(missing);
    writeHeaders_(sheet, headers);
  }

  const row = headers.map(function (header) {
    if (header === TIMESTAMP_HEADER) return new Date();
    return Object.prototype.hasOwnProperty.call(answers, header) ? toCell_(answers[header]) : '';
  });
  sheet.appendRow(row);
}

function readAll_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { headers: [], rows: [] };

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const record = values[i];
    if (record.every(function (cell) { return cell === '' || cell === null; })) continue;
    const item = {};
    headers.forEach(function (header, j) {
      if (!header) return;
      let cell = record[j];
      if (cell instanceof Date) cell = isNaN(cell.getTime()) ? '' : cell.toISOString();
      item[header] = cell;
    });
    rows.push(item);
  }
  return { headers: headers.filter(Boolean), rows: rows };
}

// ─── ΑΥΘΕΝΤΙΚΟΠΟΙΗΣΗ ────────────────────────────────────────────────────────

function checkAdminKey_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty(ADMIN_KEY_PROPERTY) || '';
  if (expected.length < LIMITS.minKeyLength) {
    console.warn('ADMIN_KEY λείπει ή είναι μικρότερος από ' + LIMITS.minKeyLength + ' χαρακτήρες. Τρέξτε setup().');
    return { ok: false, error: 'not_configured' };
  }

  // Χωρίς κωδικό: απλή άρνηση (π.χ. κάποιος άνοιξε το URL στον browser).
  if (typeof provided !== 'string' || provided === '') return { ok: false, error: 'unauthorized' };

  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('auth_fails') || 0);
  if (fails >= LIMITS.authFailsBeforeLock) return { ok: false, error: 'locked' };

  if (provided.length > 256 || !safeEquals_(provided, expected)) {
    cache.put('auth_fails', String(fails + 1), LIMITS.lockSeconds);
    Utilities.sleep(700); // επιβραδύνει τις μαζικές δοκιμές κωδικών
    return { ok: false, error: 'unauthorized' };
  }
  return { ok: true };
}

/** Σύγκριση σταθερού χρόνου (δεν αποκαλύπτει πόσοι χαρακτήρες ήταν σωστοί). */
function safeEquals_(a, b) {
  const da = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, a, Utilities.Charset.UTF_8);
  const db = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b, Utilities.Charset.UTF_8);
  let diff = da.length ^ db.length;
  for (let i = 0; i < da.length && i < db.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

function generateKey_() {
  const seed = Utilities.getUuid() + Utilities.getUuid() + Date.now();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/[=_-]/g, '').slice(0, 32);
}

// ─── ΠΡΟΣΤΑΣΙΑ ΑΠΟ SPAM / ΔΙΠΛΟΕΓΓΡΑΦΕΣ ──────────────────────────────────────

function withinRateLimit_() {
  const cache = CacheService.getScriptCache();
  const bucket = 'rl_' + Math.floor(Date.now() / 60000);
  const count = Number(cache.get(bucket) || 0);
  if (count >= LIMITS.postsPerMinute) return false;
  cache.put(bucket, String(count + 1), 120);
  return true;
}

function isDuplicate_(sid) {
  return CacheService.getScriptCache().get('sid_' + sid) !== null;
}

function rememberSubmission_(sid) {
  CacheService.getScriptCache().put('sid_' + sid, '1', LIMITS.dedupeSeconds);
}

// ─── ΑΠΑΝΤΗΣΕΙΣ ─────────────────────────────────────────────────────────────

function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function clientError_(code) {
  const err = new Error(code);
  err.clientCode = code;
  return err;
}

/** Τα λάθη του server καταγράφονται μόνο στα logs του ιδιοκτήτη — ποτέ στην απάντηση. */
function handleError_(err, where) {
  if (err && err.clientCode) return reply_({ ok: false, error: err.clientCode });
  console.error(where + ' failed: ' + (err && err.stack ? err.stack : err));
  return reply_({ ok: false, error: 'server_error' });
}

function isPlainObject_(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
