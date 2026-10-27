// RU / EN localisation. Default: Russian; English if the browser language isn't Russian and nothing is saved.
import { ITEMS, TYPES, TYPE_RU, ZONES, WEEK } from '/shared/world.js';
import { ACHIEVEMENTS } from '/shared/achievements.js';

const saved = localStorage.getItem('3008lang');
export let lang = saved === 'en' || saved === 'ru' ? saved : (/^(ru|uk|be|kk)/i.test(navigator.language || 'ru') || !navigator.language ? 'ru' : 'en');
export const setLang = (l) => { lang = l; localStorage.setItem('3008lang', l); document.documentElement.lang = l; };
document.documentElement.lang = lang;

const RU_WEEK = { Monday: 'Понедельник', Tuesday: 'Вторник', Wednesday: 'Среда', Thursday: 'Четверг', Friday: 'Пятница', Saturday: 'Суббота', Sunday: 'Воскресенье' };
export const wd = (w) => lang === 'ru' ? RU_WEEK[w] || w : w;
export const iname = (t) => (lang === 'ru' ? ITEMS[t]?.ru : ITEMS[t]?.name) || t;
export const tname = (t) => (lang === 'ru' ? TYPE_RU[t] : TYPES[t]?.name) || t;
export const zname = (z) => (lang === 'ru' ? ZONES[z]?.ru : ZONES[z]?.name) || '';
export const nm = (o) => o ? (lang === 'ru' ? o.ru : o.en) : '';
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };

const S = {
  play: ['ВОЙТИ В МАГАЗИН', 'ENTER THE STORE'], name: ['Твоё имя', 'Your name'], sub: ['Бесконечный мебельный магазин. Ночью выходят сотрудники.', 'An endless furniture store. The staff come out at night.'],
  hint: ['Переживи ночи. Построй крепость. Не попадайся им на глаза.', "Survive the nights. Build a fort. Don't let them see you."],
  avatarBtn: ['Персонаж', 'Avatar'], achBtn: ['Достижения', 'Achievements'], settingsT: ['Настройки', 'Settings'],
  hudMode: ['Интерфейс (H)', 'Interface (H)'], hudFull: ['Полный', 'Full'], hudMin: ['Минимальный HUD', 'Minimal HUD'], hudOff: ['Скрыть HUD', 'Hide HUD'], mapSet: ['Миникарта (N)', 'Minimap (N)'],
  sens: ['Чувствительность мыши', 'Mouse sensitivity'], vol: ['Громкость', 'Volume'], gfx: ['Графика', 'Graphics'], low: ['Низкая (быстро)', 'Low (fast)'], med: ['Средняя', 'Medium'], high: ['Высокая (тени)', 'High (shadows)'],
  invY: ['Инверсия Y', 'Invert Y'], tips: ['Подсказки', 'Show tips'], fps: ['Счётчик FPS', 'FPS counter'], language: ['Язык', 'Language'],
  paused: ['Пауза', 'Paused'], resume: ['Продолжить', 'Resume'], controls: ['Управление', 'Controls'], close: ['Закрыть', 'Close'], died: ['Ты погиб', 'You died'], respawn: ['Возродиться', 'Respawn'],
  chatPh: ['Напиши что-нибудь… (/help)', 'Say something… (/help)'], board: ['🏆 Выжившие в магазине', '🏆 Store Survivors'], online: ['Онлайн', 'Online'], allTime: ['За всё время (ночей)', 'All-time (most nights)'],
  bName: ['Имя', 'Name'], bLv: ['Ур', 'Lv'], bNights: ['Ночи', 'Nights'], bKos: ['Нокауты', 'KOs'], bBest: ['Рекорд', 'Best'], players: ['Игроки', 'Players'], days: ['Дни', 'Days'],
  inventory: ['🎒 Инвентарь', '🎒 Inventory'], crafting: ['🔨 Крафт', '🔨 Crafting'], chest: ['📦 Сундук', '📦 Chest'],
  invHint: ['Перетаскивай предметы · Shift+клик — разделить · ПКМ — использовать · перетащи за окно — выбросить · 1–8 на предмете — назначить в слот', 'Drag to move · Shift+click splits · RMB uses · drag outside drops · press 1–8 over an item to bind it'],
  hotbar: ['Панель быстрого доступа', 'Hotbar'], backpack: ['Рюкзак', 'Backpack'], empty: ['Пусто', 'Empty'], craftBtn: ['Создать', 'Craft'], needBench: ['у верстака', 'at a workbench'], needStove: ['у плиты', 'at a stove'],
  all: ['Всё', 'All'], build: ['Строительство', 'Building'], defense: ['Оборона', 'Defence'], weapon: ['Оружие', 'Weapons'], tool: ['Инструменты', 'Tools'], med: ['Медицина', 'Medicine'], food: ['Еда', 'Food'], light: ['Свет', 'Light'],
  placeable: ['ставится в мир', 'placeable'], materials: ['Материалы', 'Materials'], dmg: ['урон', 'dmg'], durab: ['прочность', 'durability'], breakPow: ['ломает мебель ×', 'breaks furniture ×'],
  food_: ['сытость', 'food'], energy_: ['энергия', 'energy'], heal_: ['здоровье', 'health'], matDesc: ['Материал для крафта — добывается из сломанной мебели', 'Crafting material — salvaged from broken furniture'],
  use: ['Использовать', 'Use'], drop: ['Выбросить', 'Drop'], dropOne: ['Выбросить 1', 'Drop 1'], split: ['Разделить', 'Split'], toChest: ['В сундук', 'To chest'], take: ['Взять', 'Take'],
  carrying: ['Несёшь', 'Carrying'], carryHelp: ['<b>ЛКМ/Q</b> поставить · <b>R</b> повернуть · <b>V</b> высота', '<b>LMB/Q</b> place · <b>R</b> rotate · <b>V</b> height'],
  pickUp: ['подобрать', 'pick up'], grab: ['взять', 'grab'], hit: ['ломать', 'break'], anchored: ['закреплено', 'anchored'], anchor: ['закрепить', 'anchor'], unanchor: ['открепить', 'unanchor'],
  open: ['открыть', 'open'], closeDoor: ['закрыть', 'close'], sleep: ['спать', 'sleep'], cook: ['готовить', 'cook'], craftHere: ['крафт', 'craft'], sleeping: ['💤 Спишь… <b>Z</b>/движение — проснуться', '💤 Sleeping… <b>Z</b>/move to wake'],
  day: ['День', 'Day'], night: ['Ночь', 'Night'], blood: ['Кровавая ночь', 'Blood night'], fog: ['Туманный день', 'Foggy day'], dayL: ['День', 'Day'],
  opens: ['откроется через', 'opens in'], closes: ['закроется через', 'closes in'], wp: ['Метка', 'Waypoint'], wpCleared: ['Метки удалены', 'Waypoints cleared'],
  wpPlaced: ['Метка поставлена ({n}/4) — Shift+T удалить все', 'Waypoint placed ({n}/4) — Shift+T clears'], nothingAnchor: ['Рядом нет твоей мебели', 'Nothing of yours to anchor nearby'],
  attackLmb: ['Атакуй ЛКМ', 'Attack with LMB'], matUse: ['Материалы — для крафта (C)', 'Use materials in crafting (C)'], disconnected: ['Связь потеряна — переподключение…', 'Disconnected — reconnecting…'],
  baseCamp: ['⛺ База {n}', "⛺ {n}'s Base Camp"], party: ['Команда · ', 'Party · '], pvpOn: ['⚔ PvP ВКЛ', '⚔ PvP ON'], sleepingFlag: ['💤 Спит', '💤 Sleeping'],
  nights: ['{n} {w} пережито · {k} нокаутов', '{n} night{s} survived · {k} KOs'], achGot: ['Достижение!', 'Achievement!'], unlocked: ['Открыто на {lv} уровне:', 'Unlocked at level {lv}:'],
  streak: ['🔥 Серия: {n} {d} подряд (+{b} XP)', '🔥 Streak: {n} day{s} in a row (+{b} XP)'], loot: ['+', '+'], achTitle: ['🏆 Достижения', '🏆 Achievements'],
  height: ['Высота: {h} м', 'Height: {h} m'], undoHint: ['<b>Ctrl+Z</b> — забрать последнее поставленное', '<b>Ctrl+Z</b> undo last placement'], streakDays: ['Серия дней', 'Day streak'],
  editor: ['🎨 Редактор персонажа', '🎨 Avatar editor'], random: ['🎲 Случайно', '🎲 Random'], reset: ['↺ Сбросить', '↺ Reset'], save: ['✔ Готово', '✔ Done'], lvReq: ['Ур. {lv}', 'Lv {lv}'],
  c_body: ['Телосложение', 'Body'], c_skin: ['Кожа', 'Skin'], c_face: ['Лицо', 'Face'], c_hair: ['Причёска', 'Hair'], c_hat: ['Головной убор', 'Hat'], c_facewear: ['Очки и маски', 'Glasses & masks'],
  c_shirt: ['Верх', 'Top'], c_pants: ['Низ', 'Bottoms'], c_back: ['На спине', 'Back'], col_skin: ['Цвет кожи', 'Skin colour'], col_hair: ['Цвет волос', 'Hair colour'], col_hat: ['Цвет шапки', 'Hat colour'],
  col_shirt: ['Основной цвет', 'Main colour'], col_shirt2: ['Цвет узора', 'Pattern colour'], col_pants: ['Цвет низа', 'Bottoms colour'], col_shoes: ['Обувь', 'Shoes'], col_acc: ['Цвет аксессуара', 'Accessory colour'],
  yourLv: ['Твой уровень: {lv} — новые вещи открываются с уровнем', 'Your level: {lv} — more items unlock as you level up'], locked: ['🔒 Закрыто', '🔒 Locked'],
  fpsL: ['FPS', 'FPS'],
};
// 2.5 minimal UI: strip pictographic emoji from every displayed string (icons are SVG now)
export const noEmo = (s) => typeof s !== 'string' ? s : s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]/gu, '').replace(/^[\s·]+/, '').replace(/ {2,}/g, ' ');
export function t(k, vars) {
  const e = S[k]; let s = e ? e[lang === 'ru' ? 0 : 1] : k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b);
  return noEmo(s);
}
export const nightsLabel = (n, k) => lang === 'ru' ? `${n} ${plural(n, 'ночь', 'ночи', 'ночей')} пережито · ${k} нокаутов` : t('nights', { n, s: n === 1 ? '' : 's', k });
export const streakLabel = (n, b) => lang === 'ru' ? `Серия: ${n} ${plural(n, 'день', 'дня', 'дней')} подряд (+${b} XP)` : t('streak', { n, s: n === 1 ? '' : 's', b });

// ---------- translating server strings (the server speaks English) ----------
const findItem = (en) => Object.keys(ITEMS).find(k => ITEMS[k].name === en);
const findType = (en) => Object.keys(TYPES).find(k => TYPES[k].name === en);
const I = (en) => { const k = findItem(en); return k ? iname(k) : T(en); };
const T = (en) => { const k = findType(en); return k ? tname(k) : en; };
const IT = (en) => { const k = findItem(en); return k ? iname(k) : T(en); };
const NPC_RU = { Employee: 'Сотрудника', Runner: 'Бегуна', Manager: 'Менеджера' };
const ACH_RU = Object.fromEntries(ACHIEVEMENTS.map(a => [a.en, a.ru]));
const EXACT = {
  'Empty the chest first': 'Сначала опустоши сундук', 'Inventory full — press G to drop something': 'Инвентарь полон — нажми G, чтобы выбросить что-нибудь',
  'Nothing to undo': 'Нечего отменять', 'Respawned at your base camp': 'Ты возродился на своей базе',
  'Sleeping… (move to wake up). If everyone sleeps at night, the night is skipped.': 'Спишь… (двигайся, чтобы проснуться). Если ночью спят все — ночь пропускается.',
  'Something is in the doorway': 'В проёме что-то есть', 'Something is resting on top of it': 'Сверху на этом что-то стоит', 'Step back to place it': 'Отойди назад, чтобы поставить',
  'The store is full of furniture!': 'Магазин переполнен мебелью!', 'The store will close in 30 seconds. Please proceed to the exit.': 'Магазин закроется через 30 секунд. Пожалуйста, пройдите к выходу.',
  'Too far to place': 'Слишком далеко, чтобы поставить', 'Too far to undo': 'Слишком далеко для отмены', 'You need to be next to a bed': 'Нужно стоять рядом с кроватью',
  'You need to stand next to a stove to cook': 'Чтобы готовить, встань рядом с плитой', 'You need to stand next to a workbench': 'Нужно стоять у верстака', 'Your hands are full': 'Руки заняты',
  '😴 Everyone fell asleep… the night passes.': '😴 Все уснули… ночь проходит.', 'The chest is full': 'Сундук полон', 'Something is in the way': 'Что-то мешает',
  'Too high — that would hit the ceiling': 'Слишком высоко — упрётся в потолок', 'Disconnected — reconnecting…': 'Связь потеряна — переподключение…',
  "Welcome! Today's special: meatballs in the Cafeteria.": 'Добро пожаловать! Сегодня в Кафетерии — фрикадельки.', 'Have you visited the Information Booth?': 'Вы уже посетили Справочное бюро?',
  'Please do not climb on display furniture.': 'Пожалуйста, не залезайте на выставочную мебель.', 'Lost children can be collected at the Information Booth.': 'Потерявшихся детей можно забрать в Справочном бюро.',
  'Remember to eat and rest. Energy matters.': 'Не забывайте есть и отдыхать. Энергия важна.', 'Please do not feed the staff.': 'Пожалуйста, не кормите персонал.',
  'Please do not break the display furniture.': 'Пожалуйста, не ломайте выставочную мебель.', 'The store is closed.': 'Магазин закрыт.', 'Please exit the building.': 'Пожалуйста, покиньте здание.',
  'Staff will assist you shortly.': 'Сотрудник скоро вам поможет.', 'There is no exit.': 'Выхода нет.', 'Excuse me, the store is now closed. Please exit the building.': 'Извините, магазин закрыт. Пожалуйста, покиньте здание.',
  'Excuse me… the store is now closed. Please exit the building.': 'Извините… магазин закрыт. Пожалуйста, покиньте здание.',
  'Nobody to invite. Usage: /team invite NAME': 'Некого приглашать. Используй: /team invite ИМЯ',
};
const WHY = [[/^starved to death$/, () => 'умер от голода'], [/^died eating a (.+)$/, (m) => `умер, съев «${I(m[1])}»`], [/^was taken out by (.+)$/, (m) => `был побеждён игроком ${m[1]}`], [/^was caught by a (.+)$/, (m) => `был пойман: ${NPC_RU[m[1]]?.replace(/а$/, '') || m[1]}`]];
const RX = [
  [/^(.+) wandered into the store$/, m => `${m[1]} забрёл в магазин`],
  [/^(.+) invited you to their team\. Type \/team accept$/, m => `${m[1]} приглашает тебя в команду. Напиши /team accept`],
  [/^(.+) joined the party$/, m => `${m[1]} вступил в команду`], [/^(.+) left the party$/, m => `${m[1]} покинул команду`], [/^(.+) left the store$/, m => `${m[1]} покинул магазин`],
  [/^(.+) reached level (\d+)$/, m => `${m[1]} достиг ${m[2]} уровня`], [/^(.+) 🗡 knocked down a (\w+)$/, m => `${m[1]} 🗡 вырубил ${NPC_RU[m[2]] || m[2]}`],
  [/^Anchored by (.+)$/, m => `Закреплено игроком ${m[1]}`], [/^Crafted (.+)!$/, m => `Создано: ${IT(m[1])}!`], [/^Missing materials for (.+)$/, m => `Не хватает материалов для «${IT(m[1])}»`],
  [/^Good morning! It's (\w+), Day (\d+)\. The store is now open\.(.*)$/, m => `Доброе утро! Сегодня ${RU_WEEK[m[1]]?.toLowerCase() || m[1]}, день ${m[2]}. Магазин открыт.` + (m[3].includes('FOGGY') ? ' Сегодня ТУМАННЫЙ ДЕНЬ — сотрудники остаются враждебными.' : '') + (m[3].includes('restocked') ? ' Полки пополнены.' : '')],
  [/^LEVEL UP! You are now level (\d+)$/, m => `НОВЫЙ УРОВЕНЬ! Теперь у тебя ${m[1]} уровень`], [/^Locked by (.+)$/, m => `Заперто игроком ${m[1]}`], [/^Only (.+) can weld this$/, m => `Закрепить это может только ${m[1]}`],
  [/^Picked up (.+)$/, m => `Подобрано: ${IT(m[1])}`], [/^This area is claimed by (.+)$/, m => `Эта территория принадлежит игроку ${m[1]}`],
  [/^You survived the night! \((\d+) total\)$/, m => `Ты пережил ночь! (всего ${m[1]})`], [/^Your (.+) broke!$/, m => `${IT(m[1])} сломался!`],
  [/^☠ (.+?) (starved to death|died eating a .+|was taken out by .+|was caught by a .+) \(survived (\d+) nights?\)$/, m => { const w = WHY.map(([r, f]) => { const k = r.exec(m[2]); return k && f(k); }).find(Boolean); return `☠ ${m[1]} ${w || m[2]} (пережито ночей: ${m[3]})`; }],
  [/^🏆 (.+) earned an achievement: (.+)$/, m => `🏆 ${m[1]} получил достижение: ${ACH_RU[m[2]] || m[2]}`], [/^💥 Employees smashed (.+)'s (.+)$/, m => `💥 Сотрудники разнесли: ${T(m[2])} (${m[1]})`],
  [/^🚩 (.+) set up a base camp$/, m => `🚩 ${m[1]} основал базу`], [/^🔩 (.+) anchored$/, m => `🔩 ${T(m[1])}: закреплено`], [/^(.+) unanchored$/, m => `${T(m[1])}: откреплено`], [/^Used (.+)$/, m => `Использовано: ${IT(m[1])}`],
  [/^Attention customers: the store is now closed\. Please exit the building\.(.*)$/, m => 'Уважаемые покупатели: магазин закрыт. Пожалуйста, покиньте здание.' + (m[1] ? ' Сегодня КРОВАВАЯ НОЧЬ.' : '')],
];
export function tr(s) { return noEmo(tr0(s)); }
function tr0(s) {
  if (lang !== 'ru' || typeof s !== 'string') return s;
  if (EXACT[s]) return EXACT[s];
  const pre = /^(📢 |💤 )/.exec(s); if (pre && EXACT[s.slice(pre[0].length)]) return pre[0] + EXACT[s.slice(pre[0].length)];
  for (const [r, f] of RX) { const m = r.exec(s); if (m) return f(m); }
  return s;
}
