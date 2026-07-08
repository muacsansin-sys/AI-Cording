const STORAGE_KEYS = {
  session: 'lovebridge.session',
  messages: 'lovebridge.messages',
  events: 'lovebridge.events',
  settings: 'lovebridge.translation',
  startDate: 'lovebridge.startDate'
};

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_GEMINI_API_KEY = '';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  tabs: $$('.tab'),
  views: $$('.view'),
  profileBadge: $('#profileBadge'),
  homeCode: $('#homeCode'),
  homeConnection: $('#homeConnection'),
  nextEvent: $('#nextEvent'),
  nextEventDetail: $('#nextEventDetail'),
  aiSuggestion: $('#aiSuggestion'),
  translationMode: $('#translationMode'),
  storageMode: $('#storageMode'),
  firebaseMode: $('#firebaseMode'),
  messageList: $('#messageList'),
  chatForm: $('#chatForm'),
  chatInput: $('#chatInput'),
  chatStatus: $('#chatStatus'),
  clearChatBtn: $('#clearChatBtn'),
  eventForm: $('#eventForm'),
  eventTitle: $('#eventTitle'),
  eventDate: $('#eventDate'),
  eventType: $('#eventType'),
  eventList: $('#eventList'),
  profileForm: $('#profileForm'),
  profileName: $('#profileName'),
  partnerCode: $('#partnerCode'),
  connectionState: $('#connectionState'),
  connectionStatus: $('#connectionStatus'),
  apiConfigForm: $('#apiConfigForm'),
  apiKeyInput: $('#apiKeyInput'),
  modelInput: $('#modelInput'),
  apiStatus: $('#apiStatus'),
  firebaseConfigForm: $('#firebaseConfigForm'),
  firebaseApiKeyInput: $('#firebaseApiKeyInput'),
  firebaseAuthDomainInput: $('#firebaseAuthDomainInput'),
  firebaseProjectIdInput: $('#firebaseProjectIdInput'),
  firebaseStorageBucketInput: $('#firebaseStorageBucketInput'),
  firebaseMessagingSenderIdInput: $('#firebaseMessagingSenderIdInput'),
  firebaseAppIdInput: $('#firebaseAppIdInput'),
  firebaseConfigStatus: $('#firebaseConfigStatus'),
  startDateInput: $('#startDateInput'),
  saveStartDateBtn: $('#saveStartDateBtn'),
  daysTogether: $('#daysTogether'),
  milestoneMessage: $('#milestoneMessage'),
  generateMessageBtn: $('#generateMessageBtn'),
  milestoneList: $('#milestoneList')
};

const state = {
  user: null,
  couple: null,
  messages: [],
  events: [],
  translation: { apiKey: DEFAULT_GEMINI_API_KEY, model: DEFAULT_MODEL },
  startDate: '',
  firestore: null
};

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }).format(date);
}

function daysBetween(start, end = new Date()) {
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return 0;
  const today = new Date(end);
  const diff = today.setHours(0, 0, 0, 0) - startDate.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(diff / 86400000) + 1);
}

function detectLanguage(text) {
  return /[\u0E00-\u0E7F]/.test(text) ? 'th' : 'ko';
}

function fallbackTranslate(text, source = detectLanguage(text)) {
  const normalized = text.trim().toLowerCase();
  const dictionary = {
    ko: {
      '안녕': 'สวัสดี',
      '안녕, 오늘 하루 어땠어?': 'สวัสดี วันนี้เป็นยังไงบ้าง?',
      '보고 싶어': 'คิดถึงนะ',
      '보고 싶어. 오늘도 네 생각 많이 했어.': 'คิดถึงนะ วันนี้ก็คิดถึงเธอมากเลย',
      '사랑해': 'รักนะ',
      '고마워': 'ขอบคุณนะ',
      '잘 자': 'ฝันดีนะ',
      '오늘 뭐해?': 'วันนี้ทำอะไรอยู่?'
    },
    th: {
      'สวัสดี': '안녕',
      'สวัสดี วันนี้เป็นยังไงบ้าง?': '안녕, 오늘 하루 어땠어?',
      'คิดถึงนะ': '보고 싶어',
      'รักนะ': '사랑해',
      'ขอบคุณนะ': '고마워',
      'ฝันดีนะ': '잘 자',
      'วันนี้ทำอะไรอยู่?': '오늘 뭐해?'
    }
  };

  return dictionary[source]?.[normalized] || (source === 'ko'
    ? `[태국어 번역 준비중] ${text}`
    : `[한국어 번역 준비중] ${text}`);
}

async function translateText(text) {
  const source = detectLanguage(text);
  const target = source === 'ko' ? 'th' : 'ko';
  const settings = state.translation;

  const serverTranslation = await translateWithServer(text, source, target, settings.model || DEFAULT_MODEL);
  if (serverTranslation) {
    return serverTranslation;
  }

  if (!settings.apiKey) {
    return { translatedText: fallbackTranslate(text, source), source, target, engine: 'fallback' };
  }

  try {
    const model = settings.model || DEFAULT_MODEL;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;
    const prompt = [
      `Translate this ${source === 'ko' ? 'Korean' : 'Thai'} message to ${target === 'ko' ? 'Korean' : 'Thai'}.`,
      'Use a natural, affectionate tone for a real couple chat.',
      'Return only the translated text.',
      '',
      text
    ].join('\n');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
    const payload = await response.json();
    const translatedText = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return { translatedText: translatedText || fallbackTranslate(text, source), source, target, engine: translatedText ? 'gemini' : 'fallback' };
  } catch (error) {
    console.warn('Gemini translation failed:', error);
    return { translatedText: fallbackTranslate(text, source), source, target, engine: 'fallback' };
  }
}

async function translateWithServer(text, source, target, model) {
  if (window.location.protocol === 'file:') return null;

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source, target, model })
    });

    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload.translatedText) return null;
    return {
      translatedText: payload.translatedText,
      source,
      target,
      engine: payload.engine || 'gemini-server'
    };
  } catch (error) {
    console.warn('Server translation failed:', error);
    return null;
  }
}

function firebaseConfigIsUsable() {
  const config = window.firebaseConfig || {};
  return Boolean(window.firebase && config.apiKey && config.authDomain && config.projectId && config.appId);
}

function initFirebase() {
  if (state.firestore || !firebaseConfigIsUsable()) return Boolean(state.firestore);

  try {
    const app = window.firebase.apps?.length ? window.firebase.app() : window.firebase.initializeApp(window.firebaseConfig);
    state.firestore = window.firebase.firestore(app);
    return true;
  } catch (error) {
    console.warn('Firebase init failed:', error);
    state.firestore = null;
    return false;
  }
}

function coupleDoc() {
  if (!state.firestore || !state.couple?.id) return null;
  return state.firestore.collection('couples').doc(state.couple.id);
}

async function saveCoupleRemote() {
  const doc = coupleDoc();
  if (!doc || !state.user) return;

  await doc.set({
    id: state.couple.id,
    code: state.couple.code,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  await doc.collection('members').doc(state.user.id).set({
    ...state.user,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

async function saveMessageRemote(message) {
  const doc = coupleDoc();
  if (!doc) return;
  await doc.collection('messages').doc(message.id).set(message);
}

async function saveEventRemote(event) {
  const doc = coupleDoc();
  if (!doc) return;
  await doc.collection('events').doc(event.id).set(event);
}

async function loadRemoteData() {
  const doc = coupleDoc();
  if (!doc) return false;

  try {
    const [messagesSnap, eventsSnap] = await Promise.all([
      doc.collection('messages').orderBy('createdAt', 'asc').get(),
      doc.collection('events').orderBy('date', 'asc').get()
    ]);
    const remoteMessages = messagesSnap.docs.map((item) => item.data());
    const remoteEvents = eventsSnap.docs.map((item) => item.data());
    if (remoteMessages.length) state.messages = remoteMessages;
    if (remoteEvents.length) state.events = remoteEvents;
    return true;
  } catch (error) {
    console.warn('Firestore load failed:', error);
    return false;
  }
}

function persistLocalData() {
  writeJson(STORAGE_KEYS.session, { user: state.user, couple: state.couple });
  writeJson(STORAGE_KEYS.messages, state.messages);
  writeJson(STORAGE_KEYS.events, state.events);
  writeJson(STORAGE_KEYS.settings, state.translation);
  localStorage.setItem(STORAGE_KEYS.startDate, state.startDate || '');
}

function updateFirebaseConfig(config) {
  window.firebaseConfig = { ...(window.firebaseConfig || {}), ...config };
  localStorage.setItem('lovebridge-firebase-config', JSON.stringify(window.firebaseConfig));
  state.firestore = null;
  return initFirebase();
}

function renderConnection() {
  const connected = Boolean(state.user && state.couple);
  els.profileBadge.textContent = connected ? `${state.user.name} · ${state.couple.code}` : '커플 연결';
  els.homeCode.textContent = connected ? state.couple.code : '연결 전';
  els.homeConnection.textContent = connected ? `${state.user.name}님의 커플 공간입니다.` : '설정에서 커플 공간을 먼저 만들어주세요.';
  els.connectionState.textContent = connected ? '연결됨' : '미연결';
  els.connectionStatus.textContent = connected ? `커플 코드 ${state.couple.code}로 연결되었습니다.` : '아직 커플이 연결되지 않았습니다.';
  els.chatStatus.textContent = connected ? '한국어와 태국어를 자동 감지해 번역합니다.' : '커플 연결 후 메시지를 보낼 수 있습니다.';
}

function renderSettings() {
  const firebaseReady = Boolean(state.firestore);
  els.translationMode.textContent = state.translation.apiKey ? 'Gemini' : 'Fallback';
  if (window.location.protocol !== 'file:') {
    els.translationMode.textContent = 'Gemini';
  }
  els.storageMode.textContent = firebaseReady ? 'Cloud' : 'Local';
  els.firebaseMode.textContent = firebaseReady ? '연결됨' : '대기';
  els.apiKeyInput.value = state.translation.apiKey || '';
  els.modelInput.value = state.translation.model || DEFAULT_MODEL;
  els.apiStatus.textContent = window.location.protocol === 'file:'
    ? '배포 환경에서는 Vercel 환경변수 GEMINI_API_KEY로 번역합니다.'
    : `${state.translation.model || DEFAULT_MODEL} 모델과 Vercel 서버 API로 번역합니다.`;

  const config = window.firebaseConfig || {};
  els.firebaseApiKeyInput.value = config.apiKey || '';
  els.firebaseAuthDomainInput.value = config.authDomain || '';
  els.firebaseProjectIdInput.value = config.projectId || '';
  els.firebaseStorageBucketInput.value = config.storageBucket || '';
  els.firebaseMessagingSenderIdInput.value = config.messagingSenderId || '';
  els.firebaseAppIdInput.value = config.appId || '';
  els.firebaseConfigStatus.textContent = firebaseReady ? 'Firestore 저장이 활성화되었습니다.' : 'Firebase 값을 입력하면 Firestore 저장을 시도합니다.';
}

function renderMessages() {
  els.messageList.innerHTML = '';

  if (!state.messages.length) {
    els.messageList.innerHTML = '<p class="empty">아직 메시지가 없습니다.<br />짧은 안부부터 보내보세요.</p>';
    return;
  }

  state.messages.forEach((message) => {
    const bubble = document.createElement('article');
    const mine = message.senderId === state.user?.id || message.senderName === state.user?.name;
    bubble.className = `message ${mine ? 'outgoing' : 'incoming'}`;

    const sender = document.createElement('strong');
    const text = document.createElement('p');
    const translated = document.createElement('small');
    sender.textContent = message.senderName || '상대';
    text.textContent = message.text;
    translated.textContent = message.translatedText || '';

    bubble.append(sender, text, translated);
    els.messageList.appendChild(bubble);
  });

  els.messageList.scrollTop = els.messageList.scrollHeight;
}

function eventTypeLabel(type) {
  return {
    date: '데이트',
    anniversary: '기념일',
    travel: '여행',
    call: '영상통화'
  }[type] || '일정';
}

function renderEvents() {
  const sorted = [...state.events].sort((a, b) => new Date(a.date) - new Date(b.date));
  els.eventList.innerHTML = '';

  if (!sorted.length) {
    els.eventList.innerHTML = '<p class="empty">등록된 일정이 없습니다.</p>';
  }

  sorted.forEach((event) => {
    const item = document.createElement('article');
    const dateChip = document.createElement('div');
    const content = document.createElement('div');
    const title = document.createElement('strong');
    const detail = document.createElement('p');

    item.className = 'timeline-item';
    dateChip.className = 'date-chip';
    dateChip.textContent = formatDate(event.date);
    title.textContent = event.title;
    detail.textContent = `${eventTypeLabel(event.type)} · ${event.date}`;

    content.append(title, detail);
    item.append(dateChip, content);
    els.eventList.appendChild(item);
  });

  const today = new Date(new Date().toDateString());
  const upcoming = sorted.find((event) => new Date(event.date) >= today) || sorted[0];
  els.nextEvent.textContent = upcoming ? upcoming.title : '일정 없음';
  els.nextEventDetail.textContent = upcoming ? `${formatDate(upcoming.date)} · ${eventTypeLabel(upcoming.type)}` : '데이트, 통화, 여행 일정을 추가하세요.';
}

function renderMilestones() {
  els.startDateInput.value = state.startDate || '';
  const dayCount = state.startDate ? daysBetween(state.startDate) : 0;
  els.daysTogether.textContent = state.startDate ? `D+${dayCount}` : 'D+0';

  els.milestoneList.innerHTML = '';
  if (!state.startDate) {
    els.milestoneList.innerHTML = '<p class="empty">처음 만난 날을 저장하면 주요 기념일을 계산합니다.</p>';
    return;
  }

  const start = new Date(state.startDate);
  [100, 200, 365, 500, 1000].forEach((day) => {
    const date = new Date(start);
    date.setDate(start.getDate() + day - 1);

    const card = document.createElement('article');
    const chip = document.createElement('div');
    const content = document.createElement('div');
    const title = document.createElement('strong');
    const detail = document.createElement('p');

    card.className = 'milestone-card';
    chip.className = 'date-chip';
    chip.textContent = `D+${day}`;
    title.textContent = formatDate(date);
    detail.textContent = dayCount >= day ? '이미 함께 지나온 기념일입니다.' : '다가오는 기념일입니다.';

    content.append(title, detail);
    card.append(chip, content);
    els.milestoneList.appendChild(card);
  });
}

function renderSuggestions() {
  const connected = Boolean(state.couple);
  els.aiSuggestion.textContent = connected
    ? '오늘은 짧은 안부와 다음 통화 시간을 같이 보내보세요.'
    : '먼저 커플을 연결하면 채팅과 일정이 둘만의 공간에 저장됩니다.';

  if (!state.startDate) {
    els.milestoneMessage.textContent = '기념일을 설정하면 다정한 메시지 초안을 추천합니다.';
  }
}

function renderAll() {
  renderConnection();
  renderSettings();
  renderMessages();
  renderEvents();
  renderMilestones();
  renderSuggestions();
}

async function createOrJoinCouple(event) {
  event.preventDefault();
  const action = event.submitter?.value || 'create';
  const name = els.profileName.value.trim();
  const code = els.partnerCode.value.trim().toUpperCase();

  if (!name) return;
  if (action === 'join' && !code) {
    els.connectionStatus.textContent = '참여하려면 커플 코드를 입력해주세요.';
    return;
  }

  const couple = action === 'join'
    ? { id: `couple-${code.toLowerCase()}`, code }
    : { id: makeId('couple'), code: makeCode() };

  state.user = {
    id: makeId('user'),
    name,
    coupleId: couple.id,
    role: action === 'join' ? 'partner' : 'owner'
  };
  state.couple = couple;

  state.messages = (state.messages.length ? state.messages : window.demoData?.messages || []).map((message) => ({
    ...message,
    id: message.id || makeId('message'),
    coupleId: message.coupleId || couple.id
  }));
  state.events = (state.events.length ? state.events : window.demoData?.events || []).map((item) => ({
    ...item,
    id: item.id || makeId('event'),
    coupleId: item.coupleId || couple.id
  }));

  persistLocalData();
  els.profileForm.reset();
  renderAll();

  if (initFirebase()) {
    try {
      await saveCoupleRemote();
      await Promise.all([...state.messages.map(saveMessageRemote), ...state.events.map(saveEventRemote)]);
    } catch (error) {
      console.warn('Firestore profile sync failed:', error);
    }
  }

  await loadRemoteData();
  renderAll();
}

async function sendMessage(event) {
  event.preventDefault();

  if (!state.user || !state.couple) {
    els.chatStatus.textContent = '설정에서 커플을 먼저 연결해주세요.';
    return;
  }

  const text = els.chatInput.value.trim();
  if (!text) return;

  els.chatStatus.textContent = '번역 중...';
  els.chatInput.value = '';

  const translation = await translateText(text);
  const message = {
    id: makeId('message'),
    coupleId: state.couple.id,
    senderId: state.user.id,
    senderName: state.user.name,
    text,
    translatedText: translation.translatedText,
    source: translation.source,
    target: translation.target,
    engine: translation.engine,
    createdAt: new Date().toISOString()
  };

  state.messages.push(message);
  persistLocalData();
  renderMessages();

  try {
    await saveMessageRemote(message);
  } catch (error) {
    console.warn('Message remote save failed:', error);
  }

  els.chatStatus.textContent = translation.engine === 'gemini' ? 'Gemini 번역 완료' : 'Fallback 번역 완료';
}

async function addEvent(event) {
  event.preventDefault();

  if (!state.user || !state.couple) {
    els.connectionStatus.textContent = '커플 연결 후 일정을 추가할 수 있습니다.';
    return;
  }

  const record = {
    id: makeId('event'),
    coupleId: state.couple.id,
    title: els.eventTitle.value.trim(),
    date: els.eventDate.value,
    type: els.eventType.value,
    createdAt: new Date().toISOString()
  };

  if (!record.title || !record.date) return;

  state.events.push(record);
  persistLocalData();
  renderEvents();
  els.eventForm.reset();

  try {
    await saveEventRemote(record);
  } catch (error) {
    console.warn('Event remote save failed:', error);
  }
}

function saveTranslationSettings(event) {
  event.preventDefault();
  state.translation = {
    apiKey: els.apiKeyInput.value.trim() || DEFAULT_GEMINI_API_KEY,
    model: els.modelInput.value.trim() || DEFAULT_MODEL
  };
  persistLocalData();
  renderSettings();
}

function saveFirebaseSettings(event) {
  event.preventDefault();
  const config = {
    apiKey: els.firebaseApiKeyInput.value.trim(),
    authDomain: els.firebaseAuthDomainInput.value.trim(),
    projectId: els.firebaseProjectIdInput.value.trim(),
    storageBucket: els.firebaseStorageBucketInput.value.trim(),
    messagingSenderId: els.firebaseMessagingSenderIdInput.value.trim(),
    appId: els.firebaseAppIdInput.value.trim()
  };

  const ready = updateFirebaseConfig(config);
  renderSettings();
  els.firebaseConfigStatus.textContent = ready
    ? 'Firebase 연결이 준비되었습니다. 이후 데이터는 Firestore에도 저장됩니다.'
    : '설정은 저장했지만 Firebase 연결은 아직 완료되지 않았습니다.';
}

function saveStartDate() {
  state.startDate = els.startDateInput.value;
  persistLocalData();
  renderMilestones();
  generateMilestoneMessage();
}

function generateMilestoneMessage() {
  const dayCount = state.startDate ? daysBetween(state.startDate) : 0;
  const options = dayCount
    ? [
        `우리 함께한 지 D+${dayCount}. 언어가 달라도 매일 마음을 맞춰가줘서 고마워.`,
        `오늘도 내 하루에 와줘서 고마워. D+${dayCount}의 우리도 계속 따뜻하게 이어가자.`,
        `멀리 있어도 가까운 마음으로 함께한 D+${dayCount}. 앞으로도 천천히 오래 사랑하자.`
      ]
    : [
        '오늘 하루 어땠는지 물어봐줘서 고마워. 너와 이야기하는 시간이 제일 편해.',
        '언어가 조금 달라도 마음을 맞춰가려는 우리가 좋아.',
        '짧은 말이어도 네가 보내면 하루가 부드러워져.'
      ];
  els.milestoneMessage.textContent = options[Math.floor(Math.random() * options.length)];
}

function clearChat() {
  state.messages = [];
  persistLocalData();
  renderMessages();
}

function switchView(viewId) {
  els.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === viewId));
  els.views.forEach((view) => view.classList.toggle('active', view.id === viewId));
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)));
  $$('[data-jump]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.jump)));
  $$('[data-quick]').forEach((button) => {
    button.addEventListener('click', () => {
      switchView('chat');
      els.chatInput.value = button.dataset.quick;
      els.chatInput.focus();
    });
  });
  $$('.quick-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      els.chatInput.value = pill.dataset.text;
      els.chatInput.focus();
    });
  });

  els.profileBadge.addEventListener('click', () => switchView('settings'));
  els.profileForm.addEventListener('submit', createOrJoinCouple);
  els.chatForm.addEventListener('submit', sendMessage);
  els.eventForm.addEventListener('submit', addEvent);
  els.apiConfigForm.addEventListener('submit', saveTranslationSettings);
  els.firebaseConfigForm.addEventListener('submit', saveFirebaseSettings);
  els.saveStartDateBtn.addEventListener('click', saveStartDate);
  els.generateMessageBtn.addEventListener('click', generateMilestoneMessage);
  els.clearChatBtn.addEventListener('click', clearChat);
}

async function boot() {
  const session = readJson(STORAGE_KEYS.session, {});
  const savedTranslation = readJson(STORAGE_KEYS.settings, {});

  state.user = session.user || null;
  state.couple = session.couple || null;
  state.messages = readJson(STORAGE_KEYS.messages, []);
  state.events = readJson(STORAGE_KEYS.events, window.demoData?.events || []);
  state.translation = {
    apiKey: savedTranslation.apiKey || DEFAULT_GEMINI_API_KEY,
    model: savedTranslation.model || DEFAULT_MODEL
  };
  state.startDate = localStorage.getItem(STORAGE_KEYS.startDate) || '';

  initFirebase();
  if (state.user && state.couple) {
    await loadRemoteData();
  }

  bindEvents();
  renderAll();
}

boot();
