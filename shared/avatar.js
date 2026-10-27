// Avatar catalogue + validation, shared by client (editor/rendering) and server (validation).
// Every option is original: built from boxes/cylinders in code or painted on a canvas. No external assets.
// lv = level needed to unlock (best level ever reached on this device's profile).

export const SKINS = [0xf2cf6b, 0xffe0bd, 0xf5c9a0, 0xe0ac69, 0xc68642, 0x9c6a3f, 0x8d5524, 0x5c3a1e, 0x3b2414, 0xb4d4f0, 0x9fd88a, 0xd9a3e0];
export const PALETTE = [0xffffff, 0xd9d9d9, 0x8a8a8a, 0x2b2b2b, 0x111111, 0xe74c3c, 0xc0392b, 0xff8c1a, 0xf5c518, 0xfff176, 0x2ecc71, 0x1e8449, 0x3fa9f5, 0x1d4fa8, 0x1b2a4a, 0x8e44ad, 0xf06292, 0x8b5a2b, 0x5d4037, 0xd4a650];
export const HAIR_COLORS = [0x3b2a1e, 0x111111, 0x6b3f1f, 0xa0522d, 0xd4a650, 0xf3e1a0, 0xb03a1a, 0xe8e8e8, 0x3fa9f5, 0xf06292, 0x2ecc71, 0x8e44ad];

export const FACES = [
  { id: 'smile', ru: 'Улыбка', en: 'Smile' }, { id: 'grin', ru: 'Ухмылка', en: 'Grin' }, { id: 'calm', ru: 'Спокойный', en: 'Calm' },
  { id: 'wink', ru: 'Подмигивает', en: 'Wink' }, { id: 'wow', ru: 'Удивлён', en: 'Surprised' }, { id: 'happy', ru: 'Счастлив', en: 'Happy' },
  { id: 'smirk', ru: 'Хитрый', en: 'Smirk' }, { id: 'sleepy', ru: 'Сонный', en: 'Sleepy' }, { id: 'angry', ru: 'Злой', en: 'Angry' },
  { id: 'tongue', ru: 'Язык', en: 'Tongue' }, { id: 'brave', ru: 'Храбрый', en: 'Brave', lv: 3 }, { id: 'freckles', ru: 'Веснушки', en: 'Freckles' },
  { id: 'cat', ru: 'Котик', en: 'Kitty', lv: 5 }, { id: 'stars', ru: 'Звёзды', en: 'Starstruck', lv: 8 },
];
export const HAIRS = [
  { id: 'none', ru: 'Лысый', en: 'Bald' }, { id: 'short', ru: 'Короткие', en: 'Short' }, { id: 'buzz', ru: 'Ёжик', en: 'Buzz' },
  { id: 'long', ru: 'Длинные', en: 'Long' }, { id: 'spiky', ru: 'Шипы', en: 'Spiky' }, { id: 'mohawk', ru: 'Ирокез', en: 'Mohawk' },
  { id: 'afro', ru: 'Афро', en: 'Afro' }, { id: 'ponytail', ru: 'Хвост', en: 'Ponytail' }, { id: 'bob', ru: 'Каре', en: 'Bob' },
  { id: 'swoop', ru: 'Чёлка', en: 'Swoop' }, { id: 'pigtails', ru: 'Хвостики', en: 'Pigtails' }, { id: 'bun', ru: 'Пучок', en: 'Bun' },
  { id: 'curly', ru: 'Кудри', en: 'Curly', lv: 2 }, { id: 'anime', ru: 'Аниме', en: 'Anime', lv: 6 },
];
export const HATS = [
  { id: 'none', ru: 'Нет', en: 'None' }, { id: 'cap', ru: 'Кепка', en: 'Cap' }, { id: 'beanie', ru: 'Шапка', en: 'Beanie' },
  { id: 'tophat', ru: 'Цилиндр', en: 'Top hat' }, { id: 'cowboy', ru: 'Ковбойская', en: 'Cowboy' }, { id: 'headphones', ru: 'Наушники', en: 'Headphones' },
  { id: 'hardhat', ru: 'Каска', en: 'Hard hat' }, { id: 'chef', ru: 'Колпак повара', en: 'Chef hat' }, { id: 'party', ru: 'Праздничный', en: 'Party hat' },
  { id: 'bucket', ru: 'Панама', en: 'Bucket hat' }, { id: 'beret', ru: 'Берет', en: 'Beret' }, { id: 'ushanka', ru: 'Ушанка', en: 'Ushanka' },
  { id: 'backcap', ru: 'Кепка назад', en: 'Backwards cap' }, { id: 'bandana', ru: 'Бандана', en: 'Bandana' },
  { id: 'helmet', ru: 'Шлем', en: 'Helmet', lv: 3 }, { id: 'viking', ru: 'Викинг', en: 'Viking', lv: 4 }, { id: 'pumpkin', ru: 'Тыква', en: 'Pumpkin', lv: 5 },
  { id: 'wizard', ru: 'Колдун', en: 'Wizard', lv: 7 }, { id: 'crown', ru: 'Корона', en: 'Crown', lv: 10 }, { id: 'halo', ru: 'Нимб', en: 'Halo', lv: 12 },
];
export const FACEWEAR = [
  { id: 'none', ru: 'Нет', en: 'None' }, { id: 'glasses', ru: 'Очки', en: 'Glasses' }, { id: 'sunglasses', ru: 'Тёмные очки', en: 'Sunglasses' },
  { id: 'round', ru: 'Круглые очки', en: 'Round glasses' }, { id: 'eyepatch', ru: 'Повязка', en: 'Eye patch' }, { id: 'mask', ru: 'Маска', en: 'Face mask' },
  { id: 'goggles', ru: 'Защитные очки', en: 'Goggles' }, { id: 'mustache', ru: 'Усы', en: 'Mustache' }, { id: 'beard', ru: 'Борода', en: 'Beard', lv: 2 },
  { id: 'visor', ru: 'Визор', en: 'Visor', lv: 4 }, { id: 'hockey', ru: 'Хоккейная маска', en: 'Hockey mask', lv: 6 }, { id: 'monocle', ru: 'Монокль', en: 'Monocle', lv: 8 },
];
export const SHIRTS = [
  { id: 'plain', ru: 'Однотонная', en: 'Plain' }, { id: 'stripes', ru: 'Полоски', en: 'Stripes' }, { id: 'plaid', ru: 'Клетка', en: 'Plaid' },
  { id: 'star', ru: 'Звезда', en: 'Star' }, { id: 'heart', ru: 'Сердце', en: 'Heart' }, { id: 'number', ru: 'Номер 08', en: 'Number 08' },
  { id: 'hoodie', ru: 'Худи', en: 'Hoodie' }, { id: 'suit', ru: 'Костюм', en: 'Suit' }, { id: 'bolt', ru: 'Молния', en: 'Lightning' },
  { id: 'camo', ru: 'Камуфляж', en: 'Camo' }, { id: 'store', ru: 'Магазин 3008', en: '3008 logo', lv: 2 }, { id: 'smiley', ru: 'Смайлик', en: 'Smiley', lv: 3 },
  { id: 'skull', ru: 'Череп', en: 'Skull', lv: 5 }, { id: 'galaxy', ru: 'Галактика', en: 'Galaxy', lv: 9 },
];
export const PANTS = [
  { id: 'plain', ru: 'Однотонные', en: 'Plain' }, { id: 'jeans', ru: 'Джинсы', en: 'Jeans' }, { id: 'shorts', ru: 'Шорты', en: 'Shorts' },
  { id: 'track', ru: 'Спортивные', en: 'Track pants' }, { id: 'camo', ru: 'Камуфляж', en: 'Camo' }, { id: 'cargo', ru: 'Карго', en: 'Cargo' },
  { id: 'skirt', ru: 'Юбка', en: 'Skirt' }, { id: 'checker', ru: 'Шахматка', en: 'Checker', lv: 4 },
];
export const BACKS = [
  { id: 'none', ru: 'Нет', en: 'None' }, { id: 'backpack', ru: 'Рюкзак', en: 'Backpack' }, { id: 'cape', ru: 'Плащ', en: 'Cape' },
  { id: 'guitar', ru: 'Гитара', en: 'Guitar' }, { id: 'tank', ru: 'Баллон', en: 'Air tank' }, { id: 'wings', ru: 'Крылья', en: 'Wings', lv: 5 },
  { id: 'sword', ru: 'Меч в ножнах', en: 'Sheathed sword', lv: 6 }, { id: 'jetpack', ru: 'Джетпак', en: 'Jetpack', lv: 8 },
];
export const BODIES = [
  { id: 'slim', ru: 'Худой', en: 'Slim', W: 0.85, L: 1.05 }, { id: 'normal', ru: 'Обычный', en: 'Normal', W: 1, L: 1 },
  { id: 'wide', ru: 'Крепкий', en: 'Wide', W: 1.15, L: 0.97 }, { id: 'tall', ru: 'Высокий', en: 'Tall', W: 0.95, L: 1.15, lv: 3 },
  { id: 'short', ru: 'Низкий', en: 'Short', W: 1.0, L: 0.85 },
];
export const CATS = { face: FACES, hair: HAIRS, hat: HATS, facewear: FACEWEAR, shirtPat: SHIRTS, pantsPat: PANTS, back: BACKS, body: BODIES };
export const COLOR_KEYS = ['skin', 'hairColor', 'hatColor', 'shirt', 'shirt2', 'pants', 'shoes', 'accColor'];

export const DEFAULT_AVATAR = { v: 1, body: 'normal', skin: 0xf2cf6b, face: 'smile', hair: 'short', hairColor: 0x3b2a1e, hat: 'none', hatColor: 0xe74c3c, facewear: 'none',
  shirtPat: 'plain', shirt: 0x3b6fd6, shirt2: 0xffffff, pantsPat: 'jeans', pants: 0x2c3e66, shoes: 0x262626, back: 'none', accColor: 0x8b5a2b };

const has = (list, id) => list.find(o => o.id === id);
export const locked = (cat, id, lv) => (has(CATS[cat], id)?.lv || 1) > lv;

// Sanitize any input into a valid avatar. Unknown or still-locked choices fall back to defaults.
export function validateAvatar(a, level = 1) {
  const out = { ...DEFAULT_AVATAR };
  if (!a || typeof a !== 'object') return out;
  for (const [cat, list] of Object.entries(CATS)) {
    const v = a[cat];
    if (typeof v === 'string' && has(list, v) && !locked(cat, v, level)) out[cat] = v;
  }
  for (const k of COLOR_KEYS) {
    const v = a[k];
    if (Number.isInteger(v) && v >= 0 && v <= 0xffffff) out[k] = v;
  }
  return out;
}
export function randomAvatar(level = 1, rnd = Math.random) {
  const pick = (l) => l[(rnd() * l.length) | 0];
  const a = { ...DEFAULT_AVATAR };
  for (const [cat, list] of Object.entries(CATS)) { const ok = list.filter(o => (o.lv || 1) <= level); a[cat] = pick(ok).id; }
  if (rnd() < 0.45) a.hat = 'none'; if (rnd() < 0.6) a.facewear = 'none'; if (rnd() < 0.5) a.back = 'none';
  a.skin = pick(SKINS); a.hairColor = pick(HAIR_COLORS); a.hatColor = pick(PALETTE); a.shirt = pick(PALETTE); a.shirt2 = pick(PALETTE);
  a.pants = pick(PALETTE); a.shoes = pick([0x262626, 0xffffff, 0x5d4037, 0xe74c3c, 0x1d4fa8]); a.accColor = pick(PALETTE);
  return a;
}
export function unlocksAt(level) {
  const r = [];
  for (const [cat, list] of Object.entries(CATS)) for (const o of list) if (o.lv === level) r.push({ cat, ...o });
  return r;
}
