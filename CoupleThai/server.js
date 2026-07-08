const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'store.json');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function ensureStore() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ couples: [], users: [], messages: [], events: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function detectLanguage(text) {
  return /[\u0E00-\u0E7F]/.test(text) ? 'th' : 'ko';
}

function fallbackTranslate(text, source = detectLanguage(text)) {
  const dictionary = {
    ko: {
      '안녕': 'สวัสดี',
      '안녕, 오늘 어땠어?': 'สวัสดี วันนี้เป็นยังไงบ้าง?',
      '보고 싶어': 'คิดถึงนะ',
      '사랑해': 'รักนะ',
      '고마워': 'ขอบคุณนะ',
      '잘 자': 'ฝันดีนะ'
    },
    th: {
      'สวัสดี': '안녕',
      'สวัสดี วันนี้เป็นยังไงบ้าง?': '안녕, 오늘 어땠어?',
      'คิดถึงนะ': '보고 싶어',
      'รักนะ': '사랑해',
      'ขอบคุณนะ': '고마워',
      'ฝันดีนะ': '잘 자'
    }
  };
  return dictionary[source]?.[text.trim()] || (source === 'ko' ? `[태국어 번역 준비중] ${text}` : `[한국어 번역 준비중] ${text}`);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const urlPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, urlPath));

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const store = readStore();

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (url.pathname === '/api/profile/create' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const couple = { id: makeId('couple'), code: makeCode(), createdAt: new Date().toISOString() };
    const user = { id: makeId('user'), name: body.name, coupleId: couple.id, role: 'owner' };
    store.couples.push(couple);
    store.users.push(user);
    writeStore(store);
    sendJson(res, 200, { couple, user });
    return;
  }

  if (url.pathname === '/api/profile/join' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const couple = store.couples.find((item) => item.code === String(body.code || '').toUpperCase());
    if (!couple) {
      sendJson(res, 404, { error: '존재하지 않는 커플 코드입니다.' });
      return;
    }
    const user = { id: makeId('user'), name: body.name, coupleId: couple.id, role: 'partner' };
    store.users.push(user);
    writeStore(store);
    sendJson(res, 200, { couple, user });
    return;
  }

  if (url.pathname === '/api/messages' && req.method === 'GET') {
    const coupleId = url.searchParams.get('coupleId');
    sendJson(res, 200, { messages: store.messages.filter((item) => item.coupleId === coupleId) });
    return;
  }

  if (url.pathname === '/api/messages' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const message = { id: makeId('message'), ...body, createdAt: new Date().toISOString() };
    store.messages.push(message);
    writeStore(store);
    sendJson(res, 200, { message });
    return;
  }

  if (url.pathname === '/api/events' && req.method === 'GET') {
    const coupleId = url.searchParams.get('coupleId');
    sendJson(res, 200, { events: store.events.filter((item) => item.coupleId === coupleId) });
    return;
  }

  if (url.pathname === '/api/events' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const event = { id: makeId('event'), ...body, createdAt: new Date().toISOString() };
    store.events.push(event);
    writeStore(store);
    sendJson(res, 200, { event });
    return;
  }

  if (url.pathname === '/api/translate' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const source = body.source || detectLanguage(body.text || '');
    sendJson(res, 200, {
      translatedText: fallbackTranslate(body.text || '', source),
      source,
      target: source === 'ko' ? 'th' : 'ko'
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.url.startsWith('/api/')) {
    try {
      await handleApi(req, res);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`LoveBridge is running at http://localhost:${PORT}`);
});
