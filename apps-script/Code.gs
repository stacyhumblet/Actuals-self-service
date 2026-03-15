const ANALYTICS_SHEET_ID = '1bzUqQWFwTrbOyjXewA3_WC2AqgZfTnDHp4N0laaG5g8';
const ANALYTICS_TAB_NAME = 'WebApp Analytics';
const DATA_SHEET_ID      = '1j165dsa1a-DDapOCgyBLrJQ_UBa4LzCWdWez4_obLD0';
const DATA_SHEET_GID     = 1768057434;
const SLIM_CACHE_KEY     = 'actuals_slim_v1';
const SLIM_CHUNK_META    = '__slim_chunks__';
const CACHE_TTL          = 21600; // 6 hours

// Only the columns the pivot app actually needs — strips ~40% of payload
const PIVOT_COLS = [
  'Level 4 Mgr', 'Level 5 Mgr', 'Level 6 Mgr', 'Direct Manager',
  'Resource Name', 'Issue Type', 'Month of Worklog', 'Year of Worklog', 'Worklog Hours'
];

// doGet returns JSON data for the Netlify-hosted frontend
function doGet() {
  try {
    const data = getActualsData();
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Called by google.script.run from the browser after the page loads
function getActualsData() {
  const cache  = CacheService.getScriptCache();
  const cached = getSlimChunks_(cache);
  if (cached) return JSON.parse(cached);

  const url  = 'https://docs.google.com/spreadsheets/d/' + DATA_SHEET_ID +
               '/export?format=csv&gid=' + DATA_SHEET_GID;
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
    followRedirects: true
  });

  if (resp.getResponseCode() !== 200) {
    throw new Error('Data fetch failed — HTTP ' + resp.getResponseCode());
  }

  const full = parseCSV_(resp.getContentText());

  // Convert to compact array-of-arrays format (drops long key names, ~40% smaller)
  const result = {
    headers: PIVOT_COLS,
    rows:    full.rows.map(r => PIVOT_COLS.map(col => r[col] || ''))
  };

  putSlimChunks_(cache, JSON.stringify(result));
  return result;
}

// Run from the editor to verify access and warm the cache
function testDataAccess() {
  CacheService.getScriptCache().remove(SLIM_CHUNK_META);
  const result = getActualsData();
  Logger.log('Headers: ' + result.headers.join(', '));
  Logger.log('Rows loaded: ' + result.rows.length);
}

function parseCSV_(csv) {
  const lines = csv.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { rows: [] };

  const headers = splitLine_(lines[0]);
  const rows    = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = splitLine_(lines[i]);
    const row  = {};
    let hasResource = false;
    headers.forEach((h, j) => {
      row[h] = vals[j] !== undefined ? vals[j] : '';
      if (h === 'Resource Name' && row[h].trim()) hasResource = true;
    });
    if (hasResource) rows.push(row);
  }
  return { rows };
}

function splitLine_(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// CacheService cap is 100 KB per entry; batch putAll calls to avoid limits
function putSlimChunks_(cache, json) {
  try {
    const CHUNK = 90000;
    const BATCH = 20; // items per putAll call
    const total = Math.ceil(json.length / CHUNK);

    for (let b = 0; b < Math.ceil(total / BATCH); b++) {
      const pairs = {};
      for (let i = b * BATCH; i < Math.min((b + 1) * BATCH, total); i++) {
        pairs[SLIM_CACHE_KEY + '_' + i] = json.slice(i * CHUNK, (i + 1) * CHUNK);
      }
      cache.putAll(pairs, CACHE_TTL);
    }
    // Write meta key last — only set after all chunks succeed
    cache.put(SLIM_CHUNK_META, String(total), CACHE_TTL);
  } catch (e) {
    console.log('Slim cache write failed (non-fatal):', e);
  }
}

function getSlimChunks_(cache) {
  try {
    const meta = cache.get(SLIM_CHUNK_META);
    if (!meta) return null;
    const total  = parseInt(meta);
    const keys   = Array.from({ length: total }, (_, i) => SLIM_CACHE_KEY + '_' + i);
    const stored = cache.getAll(keys);
    if (Object.keys(stored).length !== total) return null;
    return keys.map(k => stored[k]).join('');
  } catch (e) {
    return null;
  }
}

function logAnalytics(action) {
  try {
    const ss    = SpreadsheetApp.openById(ANALYTICS_SHEET_ID);
    const sheet = ss.getSheetByName(ANALYTICS_TAB_NAME);
    if (!sheet) return;

    if (sheet.getLastRow() === 0) {
      const hdr = sheet.getRange(1, 1, 1, 3);
      hdr.setValues([['Email', 'Timestamp', 'Action']]);
      hdr.setFontWeight('bold');
    }

    const email = Session.getActiveUser().getEmail() || '(anonymous)';
    sheet.appendRow([email, new Date(), action]);
  } catch (e) {
    console.error('Analytics error:', e);
  }
}
