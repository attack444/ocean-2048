// 🤖 Бот-автоответчик сообщества VK «5MB2 Digital» через Bots LongPoll.
//
// Возможности:
//   - Приём входящих сообщений в ЛС сообщества (событие message_new)
//   - Приветствие + главное меню с inline-кнопками
//   - Разделы: Океан 2048, NeoBrain, Студия, Контакты, FAQ, Помощь
//   - Ответы на частые вопросы по ключевым словам
//   - Уведомления админу о новых диалогах (опционально)
//
// Параметры:
//   --token <str>    ключ доступа сообщества (сервисный ключ из «Работа с API»).
//                    Альтернатива: env VK_COMMUNITY_TOKEN
//   --group-id <id>  id сообщества (положительное число). Альтернатива:
//                    env VK_COMMUNITY_GROUP_ID
//   --admin <id>     user_id администратора для уведомлений (env VK_COMMUNITY_ADMIN)
//   --hello          при старте отправить приветственное сообщение админу (проверка)
//   --once           выполнить один LongPoll-цикл и завершиться (для теста)
//   --timeout <sec>  работать не дольше указанного времени, затем выйти (0 = бесконечно)
//   --history [N]    показать последние N сообщений диалога с админом и завершиться
//                    (проверка, что бот ответил; N по умолчанию 10)
//   --inject "<txt>" локальный тест обработчика: показать, что бот ответил бы
//                    на этот текст/команду (без обращения к VK)
//
// Запуск (бесконечно, как сервис):
//   node scripts/vk-bot.mjs --token <ключ> --group-id 228742910 --admin 259171406
// Быстрый тест без сети:
//   node scripts/vk-bot.mjs --inject "привет"
//   node scripts/vk-bot.mjs --inject "как играть в 2048"
// Живой тест (1 цикл, ~25 сек — напишите сообществу в этот момент):
//   node scripts/vk-bot.mjs --token <ключ> --group-id 228742910 --admin 259171406 --hello --once
/* global console, process, URL, fetch, setTimeout, clearTimeout */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_VERSION = '5.199';

// ---------- Загрузка локальных ключей из .env.vk (игнорируется git) ----------
// Простой парсер без зависимостей: строки КЛЮЧ=значение, комментарии #, пустые строки.
// Не перезаписывает уже заданные переменные окружения (приоритет у процесса/аргументов).
function loadEnvFile() {
  const file = join(__dirname, '..', '.env.vk');
  if (!existsSync(file)) return;
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = value;
  }
}
loadEnvFile();

// ---------- Разбор аргументов ----------
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name) => args.includes(name);

const TOKEN = flag('--token') || process.env.VK_COMMUNITY_TOKEN || '';
const GROUP_ID = Number(flag('--group-id') || process.env.VK_COMMUNITY_GROUP_ID || 0);
const ADMIN = Number(flag('--admin') || process.env.VK_COMMUNITY_ADMIN || 0);
const HELLO = has('--hello');
const ONCE = has('--once');
const TIMEOUT = Number(flag('--timeout') || 0) || 0;
const INJECT = flag('--inject');
// --history [N] — показать последние N сообщений диалога с админом (N по умолчанию 10)
const HISTORY = has('--history') ? Number(flag('--history') || 10) || 10 : 0;

if (!INJECT && (!TOKEN || !GROUP_ID)) {
  console.error(
    'Использование:\n' +
    '  node scripts/vk-bot.mjs --token <ключ_сообщества> --group-id <id> [--admin <id>] [--hello] [--once] [--timeout <sec>]\n' +
    '  node scripts/vk-bot.mjs --inject "<текст>"   # локальный тест обработчика\n' +
    'Токен: настройки сообщества → «Работа с API» → «Ключи доступа».'
  );
  process.exit(1);
}

// ---------- VK API ----------
async function api(method, params = {}, token = TOKEN, retries = 3) {
  const url = new URL(`https://api.vk.com/method/${method}`);
  const p = { access_token: token, v: API_VERSION, lang: 'ru', ...params };
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v);
  }
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) {
        const e = new Error(`VK API ${method} → ошибка ${json.error.error_code}: ${json.error.error_msg}`);
        e.code = json.error.error_code;
        // Ошибка 6 = слишком много запросов в секунду — повторить с паузой
        if (json.error.error_code === 6 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 700 * attempt));
          continue;
        }
        throw e;
      }
      return json.response;
    } catch (e) {
      if (e.code === 6 && attempt < retries) continue;
      lastErr = e;
    }
  }
  throw lastErr;
}

let randomCounter = 0;
function randomId() {
  randomCounter = (randomCounter + 1) % 1000000;
  return Math.floor(Date.now() / 1000) * 1000000 + randomCounter;
}

// Клавиатуры в правилах могут задаваться массивом рядов ([[кнопка, кнопка]]) —
// приводим к объекту {inline, buttons}, который требует VK API.
function normalizeKeyboard(k) {
  if (Array.isArray(k)) return { inline: true, buttons: k };
  return k;
}

async function sendMessage(peerId, text, keyboard, user_id) {
  const params = {
    random_id: randomId(),
    message: text,
  };
  if (keyboard) params.keyboard = JSON.stringify(normalizeKeyboard(keyboard));
  if (user_id) params.user_id = user_id;
  else params.peer_id = peerId;
  return api('messages.send', params);
}

// ---------- Контент бота ----------
const LINKS = {
  game: 'https://vk.com/app54731343',
  site: 'https://5mb2.ru',
  neobrain: 'https://neobrain.site',
};

// Кнопка «Назад в меню» (одна, в ряду) — используется в разделах
const backRow = [
  { action: { type: 'text', label: '↩️ В меню', payload: JSON.stringify({ cmd: 'menu' }) } },
];

const MAIN_MENU = {
  inline: true,
  buttons: [
    [
      { action: { type: 'text', label: '🛠 NeoBrain', payload: JSON.stringify({ cmd: 'saas' }) } },
      { action: { type: 'text', label: '👾 Студия', payload: JSON.stringify({ cmd: 'studio' }) } },
    ],
    [
      { action: { type: 'text', label: '🎮 Игры', payload: JSON.stringify({ cmd: 'games' }) } },
      { action: { type: 'text', label: '📰 Новости', payload: JSON.stringify({ cmd: 'news' }) } },
    ],
    [
      { action: { type: 'text', label: '🤝 Партнёрство', payload: JSON.stringify({ cmd: 'partner' }) } },
      { action: { type: 'text', label: '📞 Контакты', payload: JSON.stringify({ cmd: 'contacts' }) } },
    ],
    [
      { action: { type: 'text', label: '❓ FAQ', payload: JSON.stringify({ cmd: 'faq' }) } },
      { action: { type: 'text', label: '⚙️ Помощь', payload: JSON.stringify({ cmd: 'help' }) } },
    ],
  ],
};

const WELCOME = [
  '5MB2 Digital — студия и SaaS в одном сообществе 👋',
  '',
  '👾 Студия 5MB2 — игры и приложения под ключ',
  '🛠 NeoBrain — сайты, которые сами себя ведут',
  '🎮 Наши игры (в т.ч. «Океан 2048») — бесплатно в VK',
  '',
  'Что вас интересует? Выберите пункт меню 👇',
].join('\n');

// FAQ: набор правил «ключевые слова → ответ + кнопки».
// Порядок важен: более специфичные правила стоят раньше.
const FAQ = [
  {
    keys: ['как играть', 'как играть в', 'правила', 'как играть в 2048', 'геймплей'],
    text: (user) => [
      '🎮 Как играть в «Океан 2048»:',
      '',
      '1. Открой игру: vk.com/app54731343',
      '2. Соединяй одинаковые плитки-кораллы, двигая их по полю',
      '3. Собирай 2048 и исследуй 7 глубин — от Ракушки до Хозяина Моря',
      '',
      'Бесплатно, без покупок. Есть таблица рекордов и облачные сохранения!',
    ].join('\n'),
    keyboard: [[
      { action: { type: 'open_link', label: '🎮 Играть', link: LINKS.game } },
      { action: { type: 'text', label: '↩️ В меню', payload: JSON.stringify({ cmd: 'menu' }) } },
    ]],
  },
  {
    keys: ['сколько стоит', 'цена', 'стоимость', 'платно', 'бесплат', 'купить', 'покупк'],
    text: () => [
      '💰 «Океан 2048» — полностью бесплатно:',
      '— без покупок внутри',
      '— без обязательной рекламы',
      '— рекорды и сохранения в облаке',
      '',
      'Играть: vk.com/app54731343',
    ].join('\n'),
    keyboard: [[
      { action: { type: 'open_link', label: '🎮 Играть', link: LINKS.game } },
      { action: { type: 'text', label: '↩️ В меню', payload: JSON.stringify({ cmd: 'menu' }) } },
    ]],
  },
  {
    keys: ['neobrain', 'saas', 'платформ'],
    text: () => [
      '🛠 NeoBrain — SaaS-платформа для сайтов, которые «сами себя ведут»:',
      '',
      '• SEO-дашборд и аналитика',
      '• ИИ-агент для контента',
      '• Деплой сайтов за минуты',
      '',
      'Сайт: neobrain.site',
    ].join('\n'),
    keyboard: [[
      { action: { type: 'open_link', label: '🌐 neobrain.site', link: LINKS.neobrain } },
      backRow[0],
    ]],
  },
  {
    keys: ['игр', 'поиграть', '2048', 'во что поиграть', 'релиз'],
    text: () => [
      '🎮 Наши игры — продукты студии 5MB2:',
      '',
      '• «Океан 2048» — головоломка в подводном мире',
      '  (соединяй плитки-кораллы, собирай 2048, исследуй 7 глубин)',
      '',
      'Бесплатно, без покупок. Таблица рекордов и облачные сохранения.',
      '',
      'Скоро выйдут новые релизы — следите за новостями!',
    ].join('\n'),
    keyboard: [[
      { action: { type: 'open_link', label: '🎮 Играть в 2048', link: LINKS.game } },
      { action: { type: 'text', label: '❓ Как играть?', payload: JSON.stringify({ cmd: 'howto' }) } },
    ], [
      { action: { type: 'text', label: '📣 Пригласить друзей', payload: JSON.stringify({ cmd: 'invite' }) } },
      backRow[0],
    ]],
  },
  {
    keys: ['партнёр', 'партнер', 'заказ', 'заказать', 'разработк', 'сотруднич', 'под ключ', 'услуг'],
    text: () => [
      '🤝 Партнёрство с 5MB2 Digital:',
      '',
      '• заказ игры или приложения под ключ',
      '• разработка и продвижение сайтов (NeoBrain)',
      '• интеграции и сотрудничество',
      '',
      'Напишите нам сюда — обсудим ваш проект!',
    ].join('\n'),
    keyboard: [[
      { action: { type: 'open_link', label: '🌐 5mb2.ru', link: LINKS.site } },
      backRow[0],
    ]],
  },
  {
    keys: ['студи', '5mb2', 'кто вы', 'о вас', 'компани'],
    text: () => [
      '👾 Студия 5MB2 — инди-разработчики. Мы делаем:',
      '',
      '• игры (в т.ч. «Океан 2048» в VK)',
      '• веб и мобильные приложения',
      '• SaaS-сервисы (NeoBrain)',
      '',
      'Сайт: 5mb2.ru',
    ].join('\n'),
    keyboard: [[
      { action: { type: 'open_link', label: '🌐 5mb2.ru', link: LINKS.site } },
      backRow[0],
    ]],
  },
  {
    keys: ['контакт', 'связь', 'связат', 'почта', 'email', 'написать', 'поддержк'],
    text: () => [
      '📞 Связаться с нами:',
      '',
      '• Сайт: 5mb2.ru',
      '• NeoBrain: neobrain.site',
      '• Игра: vk.com/app54731343',
      '',
      'Пишите сюда, в сообщения сообщества, — отвечаем!',
    ].join('\n'),
    keyboard: [[backRow[0]]],
  },
  {
    keys: ['спасибо', 'благодар', 'круто', 'отлично', 'класс'],
    text: () => 'Рады помочь! 🙌 Заходите ещё — подписывайтесь на сообщество, чтобы не пропустить новинки. 🔔',
    keyboard: [[backRow[0]]],
  },
];

const DEFAULT_REPLY = (user) => [
  'Я ещё маленький бот и не всё понимаю 🙈',
  '',
  'Но я точно умею рассказывать про:',
  '• 👾 студию 5MB2 (игры, приложения)',
  '• 🛠 NeoBrain (SaaS, сайты)',
  '• 🎮 наши игры (в т.ч. «Океан 2048»)',
  '• 🤝 партнёрство и контакты',
  '',
  'Выберите пункт в меню 👇',
].join('\n');

const FAQ_TEXT = [
  '❓ Частые вопросы:',
  '',
  '• «Как играть в 2048?» — правила и старт игры',
  '• «Сколько стоит?» — бесплатно, без покупок',
  '• «Что такое NeoBrain?» — SaaS-платформа',
  '• «Кто вы?» — студия 5MB2 и NeoBrain',
  '• «Как заказать разработку?» — партнёрство',
  '• «Как с вами связаться?» — контакты',
  '',
  'Просто напишите вопрос — например: «как играть»',
].join('\n');

// ---------- Обработчик сообщений ----------
// Возвращает массив ответов: [{ text, keyboard }]. Чистая функция (без сети) —
// её можно тестировать через --inject.
function handleMessage(text, payload) {
  const t = String(text || '').trim().toLowerCase();
  let cmd = null;
  if (payload) {
    try { cmd = (JSON.parse(payload).cmd || null); } catch { /* игнор */ }
  }

  // Команды с кнопок
  if (cmd) {
    switch (cmd) {
      case 'menu':
        return [{ text: WELCOME, keyboard: MAIN_MENU }];
      case 'games':
        return [{
          text: [
            '🎮 Наши игры — продукты студии 5MB2:',
            '',
            '• «Океан 2048» — головоломка в подводном мире',
            '  (соединяй плитки-кораллы, собирай 2048, исследуй 7 глубин)',
            '',
            'Бесплатно, без покупок. Таблица рекордов и облачные сохранения.',
            '',
            'Скоро выйдут новые релизы — следите за новостями!',
          ].join('\n'),
          keyboard: [[
            { action: { type: 'open_link', label: '🎮 Играть в 2048', link: LINKS.game } },
            { action: { type: 'text', label: '❓ Как играть?', payload: JSON.stringify({ cmd: 'howto' }) } },
          ], [
            { action: { type: 'text', label: '📣 Пригласить друзей', payload: JSON.stringify({ cmd: 'invite' }) } },
            backRow[0],
          ]],
        }];
      case 'howto':
        return [{
          text: [
            '🎮 Как играть в «Океан 2048»:',
            '',
            '1. Открой игру по кнопке ниже',
            '2. Соединяй одинаковые плитки',
            '3. Собери 2048 и стань Хозяином Моря!',
            '',
            'Управление: свайпы/стрелки. Побеждает тот, кто собрал 2048.',
          ].join('\n'),
          keyboard: [[
            { action: { type: 'open_link', label: '🎮 Играть', link: LINKS.game } },
            backRow[0],
          ]],
        }];
      case 'invite':
        return [{
          text: [
            '📣 Зовите друзей играть вместе!',
            '',
            'Откройте игру и нажмите «Пригласить друзей» —',
            'они получат уведомление и смогут сразу присоединиться.',
            '',
            'Соревнуйтесь за место в таблице рекордов! 🏆',
          ].join('\n'),
          keyboard: [[
            { action: { type: 'open_link', label: '🎮 Играть', link: LINKS.game } },
            backRow[0],
          ]],
        }];
      case 'news':
        return [{
          text: [
            '📰 Новости 5MB2 Digital:',
            '',
            '• релизы игр (например, «Океан 2048» в VK)',
            '• обновления NeoBrain',
            '• работы студии и конкурсы',
            '',
            'Следите за лентой сообщества — всё публикуем здесь! 🔔',
          ].join('\n'),
          keyboard: [[backRow[0]]],
        }];
      case 'partner':
        return [{
          text: [
            '🤝 Партнёрство с 5MB2 Digital:',
            '',
            '• заказ игры или приложения под ключ',
            '• разработка и продвижение сайтов (NeoBrain)',
            '• интеграции и сотрудничество',
            '',
            'Напишите нам сюда — обсудим ваш проект!',
          ].join('\n'),
          keyboard: [[
            { action: { type: 'open_link', label: '🌐 5mb2.ru', link: LINKS.site } },
            backRow[0],
          ]],
        }];
      case 'saas':
        return [{
          text: [
            '🛠 NeoBrain — SaaS-платформа:',
            '',
            '• SEO-дашборд и аналитика',
            '• ИИ-агент для контента',
            '• Деплой сайтов за минуты',
            '',
            'Подробнее: neobrain.site',
          ].join('\n'),
          keyboard: [[
            { action: { type: 'open_link', label: '🌐 neobrain.site', link: LINKS.neobrain } },
            backRow[0],
          ]],
        }];
      case 'studio':
        return [{
          text: [
            '👾 Студия 5MB2 — инди-разработчики.',
            '',
            'Создаём игры и цифровые продукты, которые хочется открывать снова:',
            '— «Океан 2048» (игра в VK)',
            '— веб и мобильные приложения',
            '— SaaS-сервисы',
            '',
            'Сайт: 5mb2.ru',
          ].join('\n'),
          keyboard: [[
            { action: { type: 'open_link', label: '🌐 5mb2.ru', link: LINKS.site } },
            backRow[0],
          ]],
        }];
      case 'contacts':
        return [{
          text: [
            '📞 Контакты 5MB2 Digital:',
            '',
            '• Игра: vk.com/app54731343',
            '• Сайт: 5mb2.ru',
            '• NeoBrain: neobrain.site',
            '',
            'По любым вопросам пишите сюда — в сообщения сообщества!',
          ].join('\n'),
          keyboard: [[backRow[0]]],
        }];
      case 'faq':
        return [{ text: FAQ_TEXT, keyboard: MAIN_MENU }];
      case 'help':
        return [{
          text: [
            '⚙️ Помощь по сообществу:',
            '',
            '• новости и анонсы — в ленте сообщества',
            '• игры (в т.ч. «Океан 2048») — vk.com/app54731343',
            '• NeoBrain и студия — 5mb2.ru, neobrain.site',
            '• вопросы по продуктам — пишите сюда',
            '• кнопка «FAQ» — ответы на частые вопросы',
            '',
            'Бот в разработке, так что будьте терпеливы 😉',
          ].join('\n'),
          keyboard: MAIN_MENU,
        }];
      default:
        break;
    }
  }

  // Текстовые команды
  if (['меню', 'start', 'начать', 'старт', 'привет', 'здравствуй', 'здравств', 'hi', 'hello', 'прив'].some((k) => t.startsWith(k) || t === k)) {
    return [{ text: WELCOME, keyboard: MAIN_MENU }];
  }

  // Поиск по FAQ-правилам (по ключевым словам)
  for (const rule of FAQ) {
    if (rule.keys.some((k) => t.includes(k))) {
      return [{ text: rule.text(), keyboard: rule.keyboard }];
    }
  }

  // Не распознали
  return [{ text: DEFAULT_REPLY(), keyboard: MAIN_MENU }];
}

// ---------- LongPoll ----------
async function getLongPollServer() {
  return api('groups.getLongPollServer', { group_id: GROUP_ID });
}

// Один цикл: получить сервер (если нужно), сделать a_check, обработать обновления.
// Возвращает true, если цикл завершён штатно.
async function longPollCycle(state) {
  if (!state.server || !state.key) {
    const s = await getLongPollServer();
    state.server = s.server;
    state.key = s.key;
    state.ts = Number(s.ts) || state.ts;
  }

  const url = new URL(state.server);
  url.searchParams.set('act', 'a_check');
  url.searchParams.set('key', state.key);
  url.searchParams.set('ts', state.ts);
  url.searchParams.set('wait', '25');
  url.searchParams.set('mode', '2');
  url.searchParams.set('version', '3');

  const res = await fetch(url);
  const json = await res.json();

  if (json.failed) {
    if (json.failed === 1) {
      // История устарела — просто берём новый ts
      state.ts = Number(json.ts) || state.ts;
    } else if (json.failed === 2 || json.failed === 3) {
      // Ключ/сервер истёк — пересоздать
      state.server = null;
      state.key = null;
      state.ts = 0;
    }
    return;
  }

  state.ts = Number(json.ts) || state.ts;
  const updates = json.updates || [];
  for (const u of updates) {
    await handleUpdate(u);
  }
}

async function handleUpdate(update) {
  if (!update || update.type !== 'message_new') return;
  const msg = update.object?.message;
  if (!msg) return;
  // Не отвечаем на исходящие (от самого сообщества) и на служебные
  if (msg.out === 1) return;
  const peerId = msg.peer_id;
  const fromId = msg.from_id;
  const text = msg.text || '';
  const payload = msg.payload || null;

  // Игнорируем сообщения, присланные с ключа сообщества (например, наши уведомления)
  if (fromId === -GROUP_ID) return;

  console.log(`💬 message_new: from=${fromId} peer=${peerId} text=${JSON.stringify(text.slice(0, 60))}`);

  try {
    const replies = handleMessage(text, payload);
    for (const r of replies) {
      await sendMessage(peerId, r.text, r.keyboard);
    }
    // Уведомление админу о новом диалоге (если задан и это не сам админ)
    if (ADMIN && fromId !== ADMIN && peerId === fromId) {
      try {
        await sendMessage(ADMIN, `📩 Новое сообщение в сообщество от пользователя ${fromId}:\n«${text.slice(0, 200)}»`, undefined, ADMIN);
      } catch (e) {
        console.log('   ⚠️ Не удалось уведомить админа:', e.message);
      }
    }
  } catch (e) {
    console.log(`   ❌ Ошибка ответа: ${e.message}`);
    try {
      await sendMessage(peerId, 'Что-то пошло не так 🙈 Попробуйте ещё раз или выберите пункт меню.', MAIN_MENU);
    } catch { /* ignore */ }
  }
}

// ---------- Запуск ----------
async function main() {
  if (INJECT !== undefined) {
    console.log('🧪 Локальный тест обработчика (без VK):');
    console.log(`   Ввод: ${JSON.stringify(INJECT)}`);
    const replies = handleMessage(INJECT);
    for (const r of replies) {
      console.log('\n   📤 Ответ:');
      console.log('   ' + r.text.split('\n').join('\n   '));
      if (r.keyboard) {
        const kb = normalizeKeyboard(r.keyboard);
        const labels = kb.buttons.map((row) => row.map((b) => b.action.label).join(' | ')).join('\n          ');
        console.log(`   🎛 Кнопки:\n          ${labels}`);
      }
    }
    console.log('\n✅ Обработчик отработал. (Чтобы отправить реально — запустите бота с --token и напишите сообществу.)');
    return;
  }

  console.log(`🤖 Бот сообщества id=${GROUP_ID}`);
  if (ADMIN) console.log(`   Уведомления админу: user_id=${ADMIN}`);
  console.log(`   LongPoll: ${ONCE ? '1 цикл (~25 сек)' : 'бесконечно'}${TIMEOUT ? ` (лимит ${TIMEOUT} сек)` : ''}`);

  // Проверка: показать последние сообщения диалога с админом и завершиться
  if (HISTORY && ADMIN) {
    console.log(`\n📜 Последние сообщения диалога с админом (user_id=${ADMIN}):`);
    try {
      const r = await api('messages.getHistory', {
        user_id: ADMIN,
        count: HISTORY,
        extended: 0,
      });
      const items = r.items || [];
      for (const m of items.reverse()) {
        const who = m.out ? '→' : '←';
        const text = (m.text || '(без текста)').replace(/\n/g, ' \\n ');
        console.log(`   ${who} [${new Date(m.date * 1000).toISOString().slice(11, 19)}] ${text.slice(0, 120)}`);
      }
      console.log(`   Итого: ${items.length} сообщений`);
    } catch (e) {
      console.log(`   ❌ Ошибка: ${e.message}`);
    }
    return;
  }

  // Приветствие админу при старте (проверка прав бота)
  if (HELLO && ADMIN) {
    try {
      const r = await sendMessage(ADMIN, '🤖 Бот сообщества запущен и слушает сообщения!', undefined, ADMIN);
      console.log(`   ✅ Приветствие админу отправлено (message_id=${r})`);
    } catch (e) {
      console.log(`   ⚠️ Не удалось отправить приветствие: ${e.message}`);
    }
  }

  const state = { server: null, key: null, ts: 0 };
  const deadline = TIMEOUT ? Date.now() + TIMEOUT * 1000 : 0;
  let cycles = 0;

  while (true) {
    try {
      await longPollCycle(state);
      cycles++;
      if (ONCE) break;
      if (deadline && Date.now() > deadline) break;
    } catch (e) {
      console.log(`   ⚠️ LongPoll: ${e.message} — повтор через 3 с`);
      await new Promise((r) => setTimeout(r, 3000));
      // Сбрасываем сервер/ключ, чтобы получить свежие
      state.server = null;
      state.key = null;
    }
  }

  console.log(`\n🛑 Бот завершил работу (циклов: ${cycles}).`);
}

main().catch((e) => {
  console.error('❌ Ошибка:', e.message);
  process.exit(1);
});
