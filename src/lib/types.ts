// Секта теперь свободный текст; ниже SECTS — список преднастроенных.
export type Sect = string;
export type CreatureKind = 'kindred' | 'ghoul' | 'human' | 'other';
export type LifeStatus = 'active' | 'dead' | 'torpor' | 'missing' | 'unknown';
export type FactionKind = 'sect' | 'coterie' | 'cult' | 'package' | 'other';
export type LocationKind = 'haven' | 'elysium' | 'hunting_ground' | 'business' | 'other';
export type QuestStatus = 'Active' | 'Completed' | 'Failed' | 'OnHold';

// Kind-specific данные хранятся в JSONB-колонке kind_data
export interface GhoulData {
  domitor_id?: string | null;       // ссылка на персонажа-домитора (Kindred)
  years_served?: number;
  addiction_level?: number;          // 0-5: насколько подсажен на витае
  bond_level?: number;               // 0-3 уровень Blood Bond
  learned_disciplines?: { name: string; level: number }[];
}
export interface HumanData {
  profession?: string;               // профессия / род занятий
  allegiance?: string;               // на чьей стороне (Society of Leopold, Second Inquisition, Kindred ally...)
  masquerade_aware?: boolean;        // знает о существовании Kindred
  age?: number;
}
export interface OtherData {
  type_label?: string;               // что это вообще такое: Werewolf? Mage? Spirit?
  notes?: string;
}

export interface Discipline { name: string; level: number; }

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  settings: Record<string, unknown>;
}

export interface Character {
  id: string;
  name: string;
  is_pc: boolean;
  kind: CreatureKind;
  life_status: LifeStatus;
  kind_data: GhoulData | HumanData | OtherData | Record<string, unknown>;
  portrait_url: string | null;
  clan: string | null;
  sect: Sect;
  generation: number | null;
  sire_id: string | null;
  embrace_age: string | null;
  status_in_sect: string | null;
  location_id: string | null;
  short_desc: string | null;
  biography: string | null;
  disciplines: Discipline[];
  // Игровые шкалы оставлены в БД (но в UI скрыты, ведутся в Foundry):
  humanity: number;
  hunger: number;
  reputation: number;
  bane: string | null;
  compulsion: string | null;
  predator_type: string | null;
  notes: string | null;
  player_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  mindmap_x: number | null;
  mindmap_y: number | null;
}

export const LIFE_STATUSES: { value: LifeStatus; label: string; emoji: string; tone: string }[] = [
  { value: 'active',  label: 'Активен',   emoji: '✨', tone: 'text-bone' },
  { value: 'dead',    label: 'Final Death', emoji: '💀', tone: 'text-rose' },
  { value: 'torpor',  label: 'Торпор',    emoji: '⚰️', tone: 'text-moon' },
  { value: 'missing', label: 'Пропал',    emoji: '🌫️', tone: 'text-ash' },
  { value: 'unknown', label: 'Неизвестно', emoji: '❓', tone: 'text-ash' },
];

export type RelationshipCategory = 'mechanic' | 'personal';

export interface RelationshipType {
  id: string;
  name: string;
  is_builtin: boolean;
  description: string | null;
  category: RelationshipCategory;
}

// Двунаправленные пары связей: A→B одного типа подразумевает B→A другого.
// Используется для слияния стрелок в Mind Map в одну биграневую и для авто-reciprocal.
// Туда же — симметричные пары (Любовь↔Любовь и т. д.).
export const RECIPROCAL: Record<string, string> = {
  // Механика
  'Sire': 'Childe',
  'Childe': 'Sire',
  'Boon owed': 'Boon held',
  'Boon held': 'Boon owed',
  'Ally': 'Ally',
  'Coterie member': 'Coterie member',
  // Личное (русские)
  'Любовь': 'Любовь',
  'Враг': 'Враг',
  'Соперник': 'Соперник',
  // Touchstone — однонаправленный (вампир → его смертный якорь), reciprocal не нужен
  // Mentor / Наставник — однонаправленный, reciprocal не нужен
  // Hates/Fears/Trusts/Distrusts (Ненависть/Страх/Доверие/Недоверие) — одна сторона может
  // ненавидеть, а вторая — нет. Reciprocal не создаём автоматически.
};

export interface Relationship {
  id: string;
  from_character_id: string;
  to_character_id: string;
  type_id: string;
  description: string | null;
  started_at_date: string | null;
  started_at_session: number | null;
  strength: number;
  created_by: string | null;
  created_at: string;
}

export interface Faction {
  id: string;
  name: string;
  kind: FactionKind;
  description: string | null;
  leader_id: string | null;
  territory: string | null;
  goals: string | null;
  notes: string | null;
}

export interface LocationItem {
  id: string;
  name: string;
  kind: LocationKind;
  owner_character_id: string | null;
  owner_faction_id: string | null;
  description: string | null;
  notes: string | null;
}

export interface Quest {
  id: string;
  title: string;
  status: QuestStatus;
  description: string | null;
  reward: string | null;
  giver_id: string | null;
  received_at: string | null;
  finished_at: string | null;
  notes: string | null;
}

export interface QuestObjective {
  id: string;
  quest_id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface SessionRow {
  id: string;
  number: number | null;
  date: string | null;
  title: string | null;
  summary: string | null;
  events: string | null;
  new_npcs: string | null;
  rel_changes: string | null;
}

export interface PersonalNote {
  id: string;
  author_id: string;
  character_id: string;
  body: string;
  updated_at: string;
}

export const CLANS = [
  'Brujah','Gangrel','Malkavian','Nosferatu','Toreador','Tremere','Ventrue',
  'Banu Haqim','Hecata','Lasombra','The Ministry','Ravnos','Salubri','Tzimisce',
  'Caitiff','Thin-blood',
] as const;

export const SECTS = ['Camarilla','Anarch','Sabbat','Independent','Autarkis','Церковь Каина','Unknown'] as const;

export const CREATURE_KINDS: { value: CreatureKind; label: string; emoji: string }[] = [
  { value: 'kindred', label: 'Kindred (Vampire)', emoji: '🧛' },
  { value: 'ghoul',   label: 'Ghoul',             emoji: '🩸' },
  { value: 'human',   label: 'Human',             emoji: '👤' },
  { value: 'other',   label: 'Other',             emoji: '✨' },
];

export const KIND_SHORT: Record<CreatureKind, string> = {
  kindred: 'Vampire',
  ghoul:   'Ghoul',
  human:   'Human',
  other:   'Other',
};

export const PREDATOR_TYPES = [
  'Alleycat','Bagger','Blood Leech','Cleaver','Consensualist','Farmer',
  'Osiris','Sandman','Scene Queen','Siren','Extortionist','Graverobber','Roadside Killer','Tithe-Collector',
] as const;

export const DEFAULT_DISCIPLINES = [
  'Animalism','Auspex','Blood Sorcery','Celerity','Dominate','Fortitude',
  'Obfuscate','Oblivion','Potence','Presence','Protean','Thin-Blood Alchemy',
] as const;

// =============== Bane и Compulsion из V:tM 5e (краткая русская формулировка) ===============
// Источник: V5 Corebook + Anarch/Camarilla/Sabbat splatbooks.
// Тексты сжаты для быстрого чтения; для подробностей открой книгу правил.

export const CLAN_BANES: Record<string, string> = {
  'Brujah': 'Бан Прометея. При Bestial Failure или провокации сложность сопротивления frenzy увеличивается на Bane Severity.',
  'Gangrel': 'Зверь близок к коже. Каждый раз, входя в frenzy, получает временную животную черту (Bestial Feature) на одну ночь — на Bane Severity штук.',
  'Malkavian': 'Безумие Малкавиан. Имеют врождённое расстройство (выбирается на старте). При Bestial Failure теряют доступ к одной из Disciplines или органу чувств на сцену.',
  'Nosferatu': 'Уродство. Внешность чудовищна, никакая магия не скроет. Социальные тесты против тех, кто видит истинный облик, получают штраф Bane Severity.',
  'Toreador': 'Зачарованность красотой. При виде истинно прекрасного объекта/сцены бросают тест или теряют способность действовать пока зрелище длится.',
  'Tremere': 'Кровь не образует Blood Bond обычным способом. Чтобы создать Bond, нужно, чтобы жертва выпила 3 глотка за одну сцену, а не за 3 разные.',
  'Ventrue': 'Привередливые в питании. Могут пить только от своего Predator-preference (тип жертвы). Иначе кровь не питает и тест Hunger не сбрасывает.',
  'Banu Haqim': 'Жажда Кэйна. Отведав крови другого Kindred, должны пройти Hunger test или продолжать пить, пока не осушат жертву диосером.',
  'Hecata': 'Поцелуй смерти. Их Kiss приносит жертве боль, а не экстаз — жертва кричит и сопротивляется, пока живая.',
  'Lasombra': 'Тёмное отражение. Не отражаются в зеркалах и не записываются на цифровые носители; камеры/микрофоны/электроника часто отказывают рядом.',
  'The Ministry': 'Слабость к свету. Солнечный и яркий искусственный свет наносит им двойной урон от обычного Kindred.',
  'Ravnos': 'Не могут спать в одном месте две ночи подряд. Иначе при пробуждении получают Aggravated damage равный Bane Severity.',
  'Salubri': 'Третий глаз. На лбу глаз, открывающийся при использовании Discipline. Желанная цель: их крови приписывают силу — другие Kindred охотятся.',
  'Tzimisce': 'Земля и кровь. Должны спать с пригоршней "родной земли" (места, к которому привязаны) под собой. Иначе не восстанавливают Willpower и получают штраф к Disciplines.',
  'Caitiff': 'Без клана и без бана, но презираемы. Стоимость опыта на повышение Disciplines на 1 пункт выше, и +2 к сложности социальных тестов с Camarilla.',
  'Thin-blood': 'Тонкая кровь. Не имеют клана, не образуют Blood Bond, не могут создавать ghoul или Embrace. Зато слабее реагируют на солнце и могут есть.',
};

export const CLAN_COMPULSIONS: Record<string, string> = {
  'Brujah': 'Rebellion — должны бросить вызов авторитету или текущему положению вещей. Не могут согласиться с приказом или нормой; должны спорить или нарушать.',
  'Gangrel': 'Feral Impulses — действуют по инстинкту, общаются короткими фразами или рычанием, прячутся в тенях, действуют до того как подумают.',
  'Malkavian': 'Delusion — видят/слышат то, чего нет. Галлюцинации становятся реальностью для них; реагируют на воображаемое, как на настоящее.',
  'Nosferatu': 'Paranoia — должны скрыться от любого наблюдателя, проверить выходы, найти скрытое место. Не доверяют никому в комнате.',
  'Toreador': 'Obsession — должны изучать/наблюдать/коллекционировать объект интереса. Теряют фокус на остальном, пока интерес не удовлетворён.',
  'Tremere': 'Perfectionism — должны делать всё идеально. Не могут оставить ошибку, переделывают работу до совершенства, теряют время.',
  'Ventrue': 'Arrogance — должны командовать сценой. Не выполняют чужие приказы, не подчиняются равным; берут на себя роль лидера, даже если не разбираются.',
  'Banu Haqim': 'Judgment — должны судить и наказать того, кто нарушил их кодекс. Забирают кровь как штраф или физически карают.',
  'Hecata': 'Morbidity — размышляют о смерти, тлении, прошлом. Не могут жить настоящим; вспоминают усопших, обсуждают похороны.',
  'Lasombra': 'Ruthlessness — должны добиться цели любой ценой. Малейшее препятствие требует жёсткого ответа, без компромиссов.',
  'The Ministry': 'Transgression — должны нарушить табу или подбить кого-то нарушить. Развращают, искушают, ставят моральные ловушки.',
  'Ravnos': 'Tempting Fate — должны рисковать без причины. Делают вещи опасным способом, когда есть безопасный.',
  'Salubri': 'Affective Empathy — должны помочь страдающему. Забывают свои цели ради чужих, вступают в конфликт защищая невиновного.',
  'Tzimisce': 'Covetousness — должны заявить владение объектом, человеком или местом. Готовы охранять и защищать "своё" любой ценой.',
};
