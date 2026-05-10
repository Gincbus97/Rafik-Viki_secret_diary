-- =============================================================================
-- Миграция #002 — улучшения после первой сессии
-- Запускай в Supabase SQL Editor целиком, как обычно. Скрипт идемпотентен.
-- =============================================================================

-- 1) Тип существа (для PC и NPC). Vampire 5e — игроки могут быть и не вампирами.
do $$ begin
  create type creature_kind as enum ('kindred','ghoul','human','other');
exception when duplicate_object then null; end $$;

alter table public.characters
  add column if not exists kind creature_kind not null default 'kindred';

-- 2) Свободная секта вместо жёсткого ENUM, чтобы можно было вписывать свою.
do $$
declare current_type text;
begin
  select data_type into current_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'characters' and column_name = 'sect';

  if current_type <> 'text' then
    alter table public.characters alter column sect drop default;
    alter table public.characters alter column sect type text using sect::text;
    alter table public.characters alter column sect set default 'Unknown';
  end if;
end $$;

-- 3) Сохранение положения узлов в Mind Map (общее для всей группы).
alter table public.characters
  add column if not exists mindmap_x double precision,
  add column if not exists mindmap_y double precision;

-- =============================================================================
-- Готово. Если жалоб нет — поля видны в Table Editor → characters.
-- =============================================================================
