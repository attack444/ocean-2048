// Автоматизация оформления сообщества VK «5MB2 Digital» через VK API.
// Возможности:
//   --posts        публикация промо-постов (wall.post) с картинками из store/community/
//   --square       дополнительно квадратные посты (1080×1080) в ленту
//   --avatar       смена аватара сообщества (avatar-512.png)
//   --cover        смена обложки сообщества (cover-1590x400.png)
//   --description  установка названия и описания сообщества (groups.edit)
//   --no-title     не менять название сообщества (только описание) — для --description
//   --info         показать состояние сообщества (название, описание, ссылки, разделы) и выйти
// Без флагов выполняются все действия (кроме --square).
//
// Параметры:
//   --token <str>        токен доступа — ключ сообщества или токен приложения
//                        (альтернатива env VK_COMMUNITY_TOKEN)
//   --app-token <str>    токен приложения-администратора: загрузка картинок в посты
//                        (getWallUploadServer) и смена аватара. Сервисному ключу сообщества
//                        эти методы недоступны (ошибка 27). Алиас: --avatar-token.
//                        (альтернатива env VK_COMMUNITY_APP_TOKEN)
//   --group-id <id>      id сообщества (положительное число)
//   --group-name <addr>  короткий адрес сообщества (screen_name, напр. 5mb2)
//   --dry-run            показать план действий без вызова VK API
//   --force              пропустить запрос подтверждения
//   --publish-date <ts>  unix-время отложенной публикации постов (сек)
//
// Если --group-id/--group-name не заданы, сообщество находится автоматически
// по токену (groups.get, filter=admin) — берётся то, где вы администратор.
//
// Запуск:
//   npm run vk:community -- --dry-run
//   VK_COMMUNITY_TOKEN=... npm run vk:community -- --force
/* global console, process, URL, fetch, FormData, Blob, setTimeout */
import { readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
// --season autumn — публиковать осенний сезонный комплект из store/community/autumn/
// (аватар, обложка, посты). Оригинальный «океанский» комплект не затрагивается.
const SEASON_IDX_TOP = process.argv.indexOf('--season');
const SEASON = SEASON_IDX_TOP !== -1 ? (process.argv[SEASON_IDX_TOP + 1] || '').toLowerCase() : '';
const ASSET_SUBDIR = SEASON === 'autumn' ? 'autumn' : '';
const API_VERSION = '5.199';
// Базовый каталог ассетов; при --season autumn — подкаталог autumn/
const ASSETS = join(ROOT, 'store', 'community', ASSET_SUBDIR);

// ---------- Загрузка локальных ключей из .env.vk (игнорируется git) ----------
// Простой парсер без зависимостей: строки КЛЮЧ=значение, комментарии #, пустые строки.
// Не перезаписывает уже заданные переменные окружения (приоритет у процесса/аргументов).
function loadEnvFile() {
  const file = join(ROOT, '.env.vk');
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
// Ждать между запросами к VK API (сек) — защита от rate-limit и HTML-капчи.
const API_DELAY_MS = Number(flag('--api-delay') || 1200) || 1200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Повторить функцию до успеха (не-JSON/пустой ответ VK) с экспоненциальной паузой.
async function withRetry(fn, { retries = 3, label = 'запрос' } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt > retries) break;
      console.log(`    ⚠️  ${label}: ${e.message} — повтор (${attempt}/${retries})...`);
      await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

const GROUP_ID = Number(flag('--group-id') || process.env.VK_COMMUNITY_GROUP_ID || 0);
const GROUP_NAME = flag('--group-name') || process.env.VK_COMMUNITY_GROUP_NAME || '';
const TOKEN = flag('--token') || process.env.VK_COMMUNITY_TOKEN || process.env.VK_TOKEN || '';
// --post <file> — опубликовать только один пост (например promo-neobrain.png),
// чтобы дозапустить упавший пост без дубликатов.
const ONLY_POST = flag('--post') || '';
// Токен приложения-администратора (--app-token, алиас --avatar-token): нужен для загрузки
// картинок в посты (getWallUploadServer) и смены аватара (getOwnerPhotoUploadServer),
// т.к. эти методы недоступны сервисному ключу сообщества (ошибка 27).
const APP_TOKEN = flag('--app-token') || flag('--avatar-token')
  || process.env.VK_COMMUNITY_APP_TOKEN || process.env.VK_COMMUNITY_AVATAR_TOKEN || '';
const DRY_RUN = has('--dry-run');
const FORCE = has('--force');
const PUBLISH_DATE = Number(flag('--publish-date') || 0) || 0;
const NO_TITLE = has('--no-title');
const INFO = has('--info');
// --pin <id> — закрепить пост на стене (wall.pin). id поста (положительный, без owner).
const PIN_POST_ID = Number(flag('--pin') || 0) || 0;
const want = {
  posts: has('--posts') || has('--post') || !['--posts', '--square', '--avatar', '--cover', '--description', '--post']
    .some((f) => args.includes(f)), // по умолчанию всё
  square: has('--square'),
  avatar: has('--avatar') || !has('--posts'),
  cover: has('--cover') || !has('--posts'),
  description: has('--description') || !has('--posts'),
};
// Если указан хоть один из флагов --posts/--post/--square/--avatar/--cover/--description,
// то делать только их (иначе — всё).
const explicit = ['--posts', '--post', '--square', '--avatar', '--cover', '--description']
  .some((f) => args.includes(f));
if (explicit) {
  want.posts = has('--posts') || has('--post');
  want.avatar = has('--avatar');
  want.cover = has('--cover');
  want.description = has('--description');
}

// ---------- Контент сообщества (совпадает с store/COMMUNITY_VK.md) ----------
// В осеннем сезоне к описанию и постам добавляется акцент на осень/саундтрек
// (контент всё ещё актуален — процедурной музыки в игре нет).
const AUTUMN_LINE = '🍁 Осеннее обновление: в игре звучит оригинальный саундтрек!';

const COMMUNITY = {
  title: '5MB2 Digital',
  description: [
    '5MB2 Digital — инди-студия и SaaS в одном сообществе.',
    '',
    '👾 Студия 5MB2 — игры и приложения под ключ:',
    'релизы, ассеты, разработка для веба и мобильных.',
    'Сайт: 5mb2.ru',
    '',
    '🛠 NeoBrain — SaaS-платформа: SEO-дашборд, ИИ-агент,',
    'деплой сайтов за минуты. Сайт: neobrain.site',
    '',
    ...(SEASON === 'autumn' ? [AUTUMN_LINE, ''] : []),
    '🎮 Наши игры — продукты студии. «Океан 2048» —',
    'головоломка в подводном мире прямо в VK: соединяй',
    'плитки-кораллы, собирай 2048 и исследуй 7 глубин.',
    'Играть: vk.com/app54731343',
    '',
    'Здесь — новости, анонсы, обновления, конкурсы и поддержка.',
    'Подписывайся, чтобы не пропустить!',
  ].join('\n'),
};

const POSTS = [
  {
    file: 'promo-game.png',
    message: SEASON === 'autumn' ? [
      '🍁 Осень в «Океан 2048» уже здесь!',
      '',
      'Соединяй плитки-кораллы, собирай 2048 и исследуй 7 глубин —',
      'теперь под новый оригинальный саундтрек.',
      '',
      '🎻 Grand Dark Waltz звучит во всей игре, а Ancient Mystery Waltz',
      'включается в турнире и дуэлях.',
      '',
      '🎮 Играть: vk.com/app54731343',
      '✅ Бесплатно · без покупок',
      '',
      'Осень короткая — успей насладиться атмосферой! 🍂',
    ].join('\n') : [
      '🌊 Океан 2048 уже в VK!',
      '',
      'Классическая головоломка в подводном мире: соединяй плитки-кораллы,',
      'собирай 2048 и исследуй 7 глубин — от Ракушки до Хозяина Моря.',
      '',
      '🎮 Играть: vk.com/app54731343',
      '✅ Бесплатно · без покупок',
      '📊 Таблица рекордов, ежедневные бонусы и облачные сохранения',
      '',
      'Ставь ❤️ и зови друзей — кто первым соберёт 2048?',
    ].join('\n'),
  },
  {
    file: 'promo-ecosystem.png',
    message: [
      '👋 Знакомьтесь: 5MB2 Digital — студия и SaaS в одном сообществе!',
      '',
      '👾 Студия 5MB2 — игры и приложения под ключ',
      '🛠 NeoBrain — SaaS: SEO, ИИ-агент, деплой за минуты',
      '🎮 Наши игры (в т.ч. «Океан 2048») — бесплатно в VK',
      '',
      'Всё — в одном сообществе. Подписывайся, чтобы не пропустить новинки! 🔔',
    ].join('\n'),
  },
  {
    file: 'promo-studio.png',
    message: [
      '🛠 Кто стоит за «Океан 2048»?',
      '',
      'Мы — инди-студия 5MB2. Создаём игры и цифровые продукты,',
      'которые хочется открывать снова.',
      '',
      'Сайт: 5mb2.ru',
      'SaaS: neobrain.site',
      'Игра: vk.com/app54731343',
      '',
      'Следите за анонсами новых релизов! 🚀',
    ].join('\n'),
  },
  {
    file: 'promo-neobrain.png',
    message: [
      '⚡ NeoBrain — сайты, которые сами себя ведут.',
      '',
      'SaaS-платформа: SEO-дашборд, ИИ-агент и деплой за минуты.',
      'Показываем, как технологии работают на практике.',
      '',
      'Подробнее: neobrain.site',
    ].join('\n'),
  },
];

const SQUARE_POSTS = [
  {
    file: 'post-game-1080x1080.png',
    message: SEASON === 'autumn'
      ? '🍁 Океан 2048: осенняя атмосфера и новый саундтрек. Собирай 2048 и исследуй 7 глубин! Играть: vk.com/app54731343'
      : ' Океан 2048: собирай 2048, исследуй 7 глубин и стань Хозяином Моря. Играть: vk.com/app54731343',
  },
  {
    file: 'post-ecosystem-1080x1080.png',
    message: '🔔 5MB2 Digital — студия · SaaS · игры. Всё в одном сообществе. Подписывайся!',
  },
];

// ---------- VK API ----------
// api(method, params, token) — token по умолчанию TOKEN (основной).
// Для аватара можно передать AVATAR_TOKEN отдельно.
// Распарсить JSON-ответ VK; если пришёл не-JSON (HTML-капча/rate-limit) — ошибка для повтора.
async function parseJson(res, what) {
  const text = await res.text();
  if (!text) throw new Error(`VK вернул пустой ответ на ${what}`);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`VK вернул не-JSON ответ на ${what} (возможно rate-limit/капча): ${text.slice(0, 80)}`);
  }
  return json;
}

async function api(method, params = {}, token = TOKEN) {
  await sleep(API_DELAY_MS);
  const url = new URL(`https://api.vk.com/method/${method}`);
  const p = { access_token: token, v: API_VERSION, lang: 'ru', ...params };
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v);
  }
  const res = await fetch(url);
  const json = await parseJson(res, `${method}`);
  if (json.error) {
    throw new Error(`VK API ${method} → ошибка ${json.error.error_code}: ${json.error.error_msg}`);
  }
  return json.response;
}

async function upload(uploadUrl, filePath, field = 'photo') {
  const buf = readFileSync(filePath);
  const form = new FormData();
  form.append(field, new Blob([buf]), basename(filePath));
  const res = await fetch(uploadUrl, { method: 'POST', body: form });
  const json = await parseJson(res, `загрузку ${basename(filePath)}`);
  if (!json || json.error) {
    throw new Error(`Загрузка файла ${basename(filePath)} на сервер VK не удалась: ${JSON.stringify(json)}`);
  }
  return json;
}

// ---------- Определение сообщества ----------
// Если --group-id/--group-name не заданы, ищем сообщество по токену
// (groups.get, filter=admin). Если админ только одного сообщества — берём его.
async function resolveGroupId() {
  if (GROUP_ID) return GROUP_ID;
  if (GROUP_NAME) {
    const byName = await api('groups.getById', {
      group_ids: GROUP_NAME,
      fields: 'screen_name',
    });
    const g = byName[0];
    if (!g || !g.id) throw new Error(`Сообщество "${GROUP_NAME}" не найдено`);
    return g.id;
  }
  const groups = await api('groups.get', { extended: 1, filter: 'admin', fields: 'screen_name' });
  const items = groups.items || [];
  if (items.length === 0) {
    throw new Error('По этому токену не найдено сообществ, где вы администратор. '
      + 'Проверьте права токена (Управление сообществами) или укажите --group-id / --group-name.');
  }
  if (items.length > 1) {
    const list = items.map((g) => `  • id=${g.id} — ${g.name} (${g.screen_name || 'без адреса'})`).join('\n');
    throw new Error(`У токена несколько сообществ с правами админа. Укажите нужное:\n${list}\n`
      + 'Пример: npm run vk:community -- --group-id <id> --force');
  }
  const g = items[0];
  console.log(`  Сообщество определено автоматически: ${g.name} (id=${g.id})`);
  return g.id;
}

// ---------- Действия ----------
async function publishPosts(groupId, posts) {
  console.log(`\n📝 Публикация ${posts.length} пост(ов) в сообщество (owner_id=-${groupId})...`);
  const results = [];
  for (const post of posts) {
    const path = join(ASSETS, post.file);
    if (!existsSync(path)) throw new Error(`Ассет не найден: ${path}`);
    // Загрузка картинки в пост:
    //   • сервисный ключ не может photos.getWallUploadServer (ошибка 27), а getMessagesUploadServer
    //     возвращает пустое photo (картинка не загружается);
    //   • фото грузим токеном приложения (getWallUploadServer → saveWallPhoto),
    //     а сам пост публикуем ключом сообщества (wall.post с attachments).
    // VK периодически возвращает пустой/не-JSON ответ аплоада — повторяем до успеха.
    let photo = await withRetry(async () => {
      const up = await api('photos.getWallUploadServer', { group_id: groupId }, APP_TOKEN);
      const upRes = await upload(up.upload_url, path);
      if (!upRes.photo || upRes.photo === '') {
        throw new Error(`VK вернул пустое photo для ${post.file}`);
      }
      const saved = await api('photos.saveWallPhoto', {
        group_id: groupId,
        server: upRes.server,
        photo: upRes.photo,
        hash: upRes.hash,
      }, APP_TOKEN);
      return saved[0];
    }, { retries: 3, label: `загрузка фото ${post.file}` });

    const attachment = `photo${photo.owner_id}_${photo.id}`;
    const posted = await withRetry(() => api('wall.post', {
      owner_id: -groupId,
      from_group: 1,
      message: post.message,
      attachments: attachment,
      publish_date: PUBLISH_DATE || undefined,
    }), { retries: 3, label: `публикация ${post.file}` });
    const when = PUBLISH_DATE ? ` (запланирован на ${new Date(PUBLISH_DATE * 1000).toISOString()})` : '';
    console.log(`  ✓ ${post.file} → пост id=${posted.post_id}${when}`);
    results.push({ file: post.file, post_id: posted.post_id, attachment });
    // Пауза между постами — защита от rate-limit.
    if (posts.length > 1) await sleep(API_DELAY_MS * 2);
  }
  return results;
}

async function setAvatar(groupId) {
  // getOwnerPhotoUploadServer/saveOwnerPhoto недоступны сервисному ключу сообщества
  // (ошибка 27). Для аватара нужен токен приложения-администратора (--app-token).
  if (!APP_TOKEN) {
    throw new Error('Для смены аватара нужен --app-token (токен приложения-администратора, НЕ сервисный ключ).');
  }
  console.log(`\n🖼 Смена аватара сообщества (owner_id=-${groupId})...`);
  const path = join(ASSETS, 'avatar-512.png');
  if (!existsSync(path)) throw new Error(`Ассет не найден: ${path}`);
  const up = await api('photos.getOwnerPhotoUploadServer', { owner_id: -groupId }, APP_TOKEN);
  const upRes = await upload(up.upload_url, path);
  console.log('  upRes =', JSON.stringify(upRes));
  const saved = await api('photos.saveOwnerPhoto', {
    owner_id: -groupId,
    server: upRes.server,
    photo: upRes.photo,
    hash: upRes.hash,
  }, APP_TOKEN);
  console.log(`  ✓ Аватар обновлён (${saved.photo_src || 'ок'})`);
  return saved;
}

async function setCover(groupId) {
  console.log(`\n🖼 Смена обложки сообщества (group_id=${groupId})...`);
  const path = join(ASSETS, 'cover-1590x400.png');
  if (!existsSync(path)) throw new Error(`Ассет не найден: ${path}`);
  // Мин. ширина crop для обложки — 911px (иначе ошибка 100). 1590×400 подходит.
  const up = await api('photos.getOwnerCoverPhotoUploadServer', {
    group_id: groupId,
    crop_x: 0,
    crop_y: 0,
    crop_x2: 1590,
    crop_y2: 400,
  });
  const upRes = await upload(up.upload_url, path);
  await api('photos.saveOwnerCoverPhoto', {
    hash: upRes.hash,
    photo: upRes.photo,
  });
  console.log('  ✓ Обложка обновлена');
  return upRes;
}

async function setDescription(groupId) {
  const what = NO_TITLE ? 'Обновление описания (название НЕ меняется)' : 'Обновление названия и описания';
  console.log(`\n📝 ${what} сообщества (group_id=${groupId})...`);
  const params = { group_id: groupId, description: COMMUNITY.description };
  if (!NO_TITLE) params.title = COMMUNITY.title;
  await api('groups.edit', params);
  if (NO_TITLE) console.log('  ✓ Название оставлено без изменений');
  else console.log('  ✓ Название:', COMMUNITY.title);
  console.log('  ✓ Описание установлено');
  return COMMUNITY;
}

// ---------- Закрепление поста (--pin) ----------
// wall.pin доступен сервисному ключу сообщества (пост принадлежит сообществу).
async function pinPost(groupId, postId) {
  console.log(`\n📌 Закрепление поста id=${postId} на стене (owner_id=-${groupId})...`);
  await api('wall.pin', { owner_id: -groupId, post_id: postId });
  console.log(`  ✓ Пост id=${postId} закреплён`);
  return postId;
}

// ---------- Состояние сообщества (--info) ----------
// Показать текущие настройки сообщества: название, адрес, описание, ссылки в шапке,
// включённые разделы и открытость сообщения. Читает через API (сервисный ключ).
async function showInfo(groupId) {
  const fields = 'description,status,contacts,links,activity,age_limits,members_count,is_closed,is_message_blocked,market,board,video,articles,files,audio,website';
  const g = await api('groups.getById', {
    group_id: groupId,
    fields,
  });
  // groups.getById возвращает { groups: [...] } (обёртка), а не массив
  const list = Array.isArray(g) ? g : (g && g.groups) || [];
  const info = list[0] || {};
  console.log('\n📋 Состояние сообщества:');
  console.log(`  • Название: ${info.name} (id=${info.id}, адрес: ${info.screen_name || '—'})`);
  console.log(`  • Короткое описание (status): ${info.status || '(не задано)'}`);
  console.log(`  • Участников: ${info.members_count ?? '?'}`);
  console.log(`  • Тип: ${info.type || '?'}${info.is_closed ? ' (закрытое)' : ''}`);
  if (info.description) {
    console.log('  • Полное описание:');
    console.log(info.description.split('\n').map((l) => `      ${l}`).join('\n'));
  } else {
    console.log('  • Полное описание: (не задано)');
  }
  console.log('  • Ссылки в шапке (links):');
  const links = info.links || [];
  if (links.length === 0) console.log('      (нет)');
  for (const l of links) console.log(`      — ${l.name || l.url} → ${l.url}`);
  console.log('  • Разделы:');
  console.log(`      Обсуждения (board): ${info.board === 1 ? '✅ включены' : info.board === 0 ? '❌ выключены' : '—'}`);
  console.log(`      Товары (market): ${info.market === 1 ? '✅ включены' : info.market === 0 ? '❌ выключены' : '—'}`);
  console.log(`      Видео (video): ${info.video === 1 ? '✅ включены' : info.video === 0 ? '❌ выключены' : '—'}`);
  console.log(`      Статьи (articles): ${info.articles === 1 ? '✅ включены' : info.articles === 0 ? '❌ выключены' : '—'}`);
  console.log(`      Файлы (files): ${info.files === 1 ? '✅ включены' : info.files === 0 ? '❌ выключены' : '—'}`);
  console.log(`  • Сообщения: ${info.is_message_blocked === 1 ? 'закрыты' : 'открыты'}`);

  // Стена: последние посты + какой закреплён (для проверки публикаций и пина).
  // wall.get недоступен сервисному ключу (27) — пробуем app-токен, если задан.
  console.log('\n  • Стена (последние посты):');
  try {
    const w = await api('wall.get', { owner_id: -groupId, count: 6 }, APP_TOKEN || TOKEN);
    const items = w.items || [];
    if (items.length === 0) console.log('      (пусто)');
    for (const p of items) {
      const pinned = p.is_pinned === 1 ? ' 📌ЗАКРЕП' : '';
      const firstLine = (p.text || '(без текста)').split('\n')[0].slice(0, 60);
      console.log(`      id=${p.id}${pinned} [${new Date(p.date * 1000).toISOString().slice(0, 10)}] ${firstLine}`);
    }
  } catch (e) {
    console.log(`      ⚠️ wall.get: ${e.message}`);
  }
  return info;
}

// ---------- План (dry-run) ----------
function printPlan() {
  console.log('ПЛАН ДЕЙСТВИЙ (dry-run, без вызовов VK API)\n');
  const target = GROUP_ID
    ? `group_id=${GROUP_ID}`
    : GROUP_NAME
      ? `group_name=${GROUP_NAME}`
      : 'автоопределение по токену';
  console.log(`  Сообщество: ${COMMUNITY.title} (${target})`);
  if (SEASON === 'autumn') console.log('  🍁 Сезонный комплект: осенний (store/community/autumn/)');
  if (want.posts) {
    console.log(ONLY_POST ? `\n  Пост (wall.post): ${ONLY_POST}` : '\n  Посты (wall.post):');
    if (!ONLY_POST) for (const p of POSTS) console.log(`    • ${p.file}`);
  }
  if (want.square) {
    console.log('\n  Квадратные посты (wall.post):');
    for (const p of SQUARE_POSTS) console.log(`    • ${p.file}`);
  }
  if (want.avatar) console.log('\n  Аватар: avatar-512.png');
  if (want.cover) console.log('\n  Обложка: cover-1590x400.png');
  if (want.description) console.log(NO_TITLE
    ? '\n  Описание: groups.edit (название НЕ меняется)'
    : '\n  Название и описание: groups.edit');
  if (PIN_POST_ID) console.log(`\n  Закреп: пост id=${PIN_POST_ID} (wall.pin)`);
  if (PUBLISH_DATE) console.log(`\n  Отложенная публикация постов: ${new Date(PUBLISH_DATE * 1000).toISOString()}`);
}

// ---------- Подтверждение ----------
async function confirm() {
  if (FORCE || DRY_RUN) return true;
  return new Promise((resolve) => {
    process.stdout.write('\nПодтверждаете выполнение? [y/N] ');
    process.stdin.once('data', (d) => {
      resolve(String(d).trim().toLowerCase() === 'y');
    });
  });
}

async function main() {
  if (DRY_RUN) {
    printPlan();
    console.log('\n(сухой запуск завершён)');
    return;
  }
  if (!TOKEN) {
    console.error('⚠️  Не передан токен. Укажите --token <token> или переменную VK_COMMUNITY_TOKEN.');
    console.error('    Подсказка: см. store/COMMUNITY_VK.md → раздел «Получение токена».');
    printPlan();
    process.exit(1);
  }

  // Проверка типа токена: users.get возвращает профиль для токена приложения
  // и пустой массив [] для сервисного ключа сообщества. Оба варианта рабочие:
  //   • сервисный ключ — посты (wall.post), обложка, описание (groups.edit);
  //   • токен приложения — то же самое + аватар (photos.getOwnerPhotoUploadServer).
  const who = await api('users.get');
  if (who && who.length > 0) {
    console.log(`  Токен приложения подтверждён (пользователь id=${who[0].id}).`);
  } else {
    console.log('  ⚠️  Сервисный ключ сообщества: посты/обложка/описание — через ключ;');
    console.log('      загрузка картинок и аватар — через --app-token.');
  }
  if ((want.posts || want.square || want.avatar) && !APP_TOKEN) {
    console.error('❌ Запрошены посты/аватар, но не передан --app-token (токен приложения-администратора).');
    console.error('   Сервисный ключ не может грузить фото в посты/аватар (ошибка 27):');
    console.error('   dev.vk.com → приложение → «Доступ к API» → «Получить ключ доступа»,');
    console.error('   права: Управление сообществами, Фотографии. Затем --app-token <токен>.');
    process.exit(1);
  }

  // Автоопределение сообщества (если не заданы --group-id / --group-name)
  let groupId = GROUP_ID;
  if (!groupId) {
    console.log('\n🔍 Определяю сообщество по токену...');
    groupId = await resolveGroupId();
  }

  // Показать состояние сообщества и завершиться
  if (INFO) {
    await showInfo(groupId);
    return;
  }

  const ok = await confirm();
  if (!ok) {
    console.log('Отменено пользователем.');
    process.exit(0);
  }

  if (want.posts) {
    const toPublish = ONLY_POST
      ? POSTS.filter((p) => p.file === ONLY_POST)
      : POSTS;
    if (toPublish.length === 0) {
      console.error(`\n❌ Пост с файлом "${ONLY_POST}" не найден в POSTS.`);
      process.exit(1);
    }
    await publishPosts(groupId, toPublish);
  }
  if (want.square) await publishPosts(groupId, SQUARE_POSTS);
  if (PIN_POST_ID) await pinPost(groupId, PIN_POST_ID);
  if (want.avatar) await setAvatar(groupId);
  if (want.cover) await setCover(groupId);
  if (want.description) await setDescription(groupId);

  console.log('\n✅ Оформление сообщества завершено.');
}

main().catch((e) => {
  console.error('\n❌ Ошибка:', e.message);
  process.exit(1);
});
