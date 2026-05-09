-- =============================================================================
-- Vampire: The Masquerade — Chronicle Knowledge Base
-- Полная схема Postgres для Supabase. Запускай этот файл в Supabase SQL Editor.
-- =============================================================================

-- ---------- Расширения ----------
create extension if not exists "pgcrypto";

-- ---------- ENUM-типы ----------
do $$ begin
  create type sect_type as enum ('Camarilla','Anarch','Sabbat','Independent','Autarkis','Unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type faction_kind as enum ('sect','coterie','cult','package','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type location_kind as enum ('haven','elysium','hunting_ground','business','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quest_status as enum ('Active','Completed','Failed','OnHold');
exception when duplicate_object then null; end $$;

-- ---------- profiles (один на каждого зарегистрированного игрока) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  -- общие настройки игрока: { theme, hideFields: [...] }
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email,'@',1))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- relationship_types (преднастроенные + кастомные) ----------
create table if not exists public.relationship_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_builtin  boolean not null default false,
  description text,
  created_at  timestamptz not null default now()
);

insert into public.relationship_types (name, is_builtin, description) values
  ('Sire',           true, 'A is the sire of B'),
  ('Childe',         true, 'A is the childe of B'),
  ('Blood Bond 1',   true, 'A drank from B once'),
  ('Blood Bond 2',   true, 'A drank from B twice'),
  ('Blood Bond 3',   true, 'A is fully bound to B'),
  ('Ghoul',          true, 'A is a ghoul of B'),
  ('Coterie member', true, 'A and B are in the same coterie'),
  ('Boon owed',      true, 'A owes a boon to B'),
  ('Boon held',      true, 'A holds a boon over B'),
  ('Ally',           true, 'Allies'),
  ('Enemy',          true, 'Enemies'),
  ('Rival',          true, 'Rivals'),
  ('Lover',          true, 'Lovers'),
  ('Mentor',         true, 'A is mentor to B'),
  ('Knows about',    true, 'A knows something about B')
on conflict (name) do nothing;

-- ---------- characters ----------
create table if not exists public.characters (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  is_pc           boolean not null default false,
  portrait_url    text,
  clan            text,
  sect            sect_type default 'Unknown',
  generation      int,
  sire_id         uuid references public.characters(id) on delete set null,
  embrace_age     text,
  status_in_sect  text,
  location_id     uuid,                          -- FK добавим после locations
  short_desc      text,
  biography       text,
  -- disciplines: [{ "name": "Auspex", "level": 2 }, ...]
  disciplines     jsonb not null default '[]'::jsonb,
  humanity        int default 7  check (humanity   between 0 and 10),
  hunger          int default 1  check (hunger     between 0 and 5),
  reputation      int default 0  check (reputation between 0 and 10),
  bane            text,
  compulsion      text,
  predator_type   text,
  notes           text,
  -- кто из игроков "владеет" этим персонажем (null для NPC)
  player_id       uuid references public.profiles(id) on delete set null,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists characters_is_pc_idx     on public.characters(is_pc);
create index if not exists characters_clan_idx      on public.characters(clan);
create index if not exists characters_sect_idx      on public.characters(sect);
create index if not exists characters_player_id_idx on public.characters(player_id);

-- ---------- locations ----------
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        location_kind not null default 'other',
  -- владелец может быть либо персонажем, либо фракцией
  owner_character_id uuid references public.characters(id) on delete set null,
  owner_faction_id   uuid,
  description text,
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- теперь можем добавить FK для characters.location_id
alter table public.characters
  drop constraint if exists characters_location_id_fkey;
alter table public.characters
  add constraint characters_location_id_fkey
  foreign key (location_id) references public.locations(id) on delete set null;

-- ---------- factions ----------
create table if not exists public.factions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        faction_kind not null default 'coterie',
  description text,
  leader_id   uuid references public.characters(id) on delete set null,
  territory   text,
  goals       text,
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.locations
  drop constraint if exists locations_owner_faction_id_fkey;
alter table public.locations
  add constraint locations_owner_faction_id_fkey
  foreign key (owner_faction_id) references public.factions(id) on delete set null;

create table if not exists public.faction_members (
  faction_id   uuid not null references public.factions(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  role         text,
  primary key (faction_id, character_id)
);

-- ---------- relationships (направленные A → B) ----------
create table if not exists public.relationships (
  id                uuid primary key default gen_random_uuid(),
  from_character_id uuid not null references public.characters(id) on delete cascade,
  to_character_id   uuid not null references public.characters(id) on delete cascade,
  type_id           uuid not null references public.relationship_types(id) on delete restrict,
  description       text,
  started_at_date   date,
  started_at_session int,
  strength          int default 3 check (strength between 1 and 5),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  check (from_character_id <> to_character_id)
);

create index if not exists rel_from_idx on public.relationships(from_character_id);
create index if not exists rel_to_idx   on public.relationships(to_character_id);

-- ---------- quests ----------
create table if not exists public.quests (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  status       quest_status not null default 'Active',
  description  text,
  reward       text,
  giver_id     uuid references public.characters(id) on delete set null,
  received_at  date,
  finished_at  date,
  notes        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists quests_status_idx on public.quests(status);

create table if not exists public.quest_objectives (
  id        uuid primary key default gen_random_uuid(),
  quest_id  uuid not null references public.quests(id) on delete cascade,
  text      text not null,
  done      boolean not null default false,
  position  int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quest_characters (
  quest_id     uuid not null references public.quests(id)      on delete cascade,
  character_id uuid not null references public.characters(id)  on delete cascade,
  primary key (quest_id, character_id)
);

create table if not exists public.quest_locations (
  quest_id    uuid not null references public.quests(id)     on delete cascade,
  location_id uuid not null references public.locations(id)  on delete cascade,
  primary key (quest_id, location_id)
);

-- ---------- sessions ----------
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  number      int,
  date        date,
  title       text,
  summary     text,
  events      text,
  new_npcs    text,
  rel_changes text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sessions_number_idx on public.sessions(number);

create table if not exists public.session_attendees (
  session_id   uuid not null references public.sessions(id)   on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  primary key (session_id, character_id)
);

-- ---------- personal_notes (видны только автору) ----------
create table if not exists public.personal_notes (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles(id) on delete cascade,
  character_id    uuid not null references public.characters(id) on delete cascade,
  body            text not null default '',
  updated_at      timestamptz not null default now(),
  unique(author_id, character_id)
);

-- ---------- updated_at триггер ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  for t in
    select unnest(array['profiles','characters','locations','factions','quests','sessions','personal_notes'])
  loop
    execute format('drop trigger if exists tr_touch_%I on public.%I', t, t);
    execute format('create trigger tr_touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- =============================================================================
-- Row Level Security: всё видно и редактируется любым залогиненным,
-- кроме personal_notes (только автор) и settings профиля.
-- =============================================================================

alter table public.profiles            enable row level security;
alter table public.characters          enable row level security;
alter table public.relationship_types  enable row level security;
alter table public.relationships       enable row level security;
alter table public.factions            enable row level security;
alter table public.faction_members     enable row level security;
alter table public.locations           enable row level security;
alter table public.quests              enable row level security;
alter table public.quest_objectives    enable row level security;
alter table public.quest_characters    enable row level security;
alter table public.quest_locations     enable row level security;
alter table public.sessions            enable row level security;
alter table public.session_attendees   enable row level security;
alter table public.personal_notes      enable row level security;

-- Универсальный RW для авторизованных
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'characters','relationship_types','relationships','factions','faction_members',
      'locations','quests','quest_objectives','quest_characters','quest_locations',
      'sessions','session_attendees'
    ])
  loop
    execute format('drop policy if exists "auth read %I"   on public.%I', t, t);
    execute format('drop policy if exists "auth insert %I" on public.%I', t, t);
    execute format('drop policy if exists "auth update %I" on public.%I', t, t);
    execute format('drop policy if exists "auth delete %I" on public.%I', t, t);

    execute format('create policy "auth read %I"   on public.%I for select using  (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth insert %I" on public.%I for insert with check (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth update %I" on public.%I for update using  (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth delete %I" on public.%I for delete using  (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;

-- profiles: читают все авторизованные, пишет только сам пользователь свой
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select using  (auth.role() = 'authenticated');
create policy "profiles insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles update" on public.profiles for update using  (id = auth.uid()) with check (id = auth.uid());

-- personal_notes: только автор
drop policy if exists "pn read"   on public.personal_notes;
drop policy if exists "pn insert" on public.personal_notes;
drop policy if exists "pn update" on public.personal_notes;
drop policy if exists "pn delete" on public.personal_notes;
create policy "pn read"   on public.personal_notes for select using  (author_id = auth.uid());
create policy "pn insert" on public.personal_notes for insert with check (author_id = auth.uid());
create policy "pn update" on public.personal_notes for update using  (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "pn delete" on public.personal_notes for delete using  (author_id = auth.uid());

-- =============================================================================
-- Готово. Дальше — приложение.
-- =============================================================================
