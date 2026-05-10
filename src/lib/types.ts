// Секта теперь свободный текст; ниже SECTS — список преднастроенных.
export type Sect = string;
export type CreatureKind = 'kindred' | 'ghoul' | 'human' | 'other';
export type FactionKind = 'sect' | 'coterie' | 'cult' | 'package' | 'other';
export type LocationKind = 'haven' | 'elysium' | 'hunting_ground' | 'business' | 'other';
export type QuestStatus = 'Active' | 'Completed' | 'Failed' | 'OnHold';

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

export interface RelationshipType {
  id: string;
  name: string;
  is_builtin: boolean;
  description: string | null;
}

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

export const SECTS = ['Camarilla','Anarch','Sabbat','Independent','Autarkis','Unknown'] as const;

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
