-- =============================================================================
-- Миграция #004 — life_status и kind_data (поля под Kindred/Ghoul/Human/Other)
-- Безопасна для повторного запуска.
-- =============================================================================

do $$ begin
  create type character_life_status as enum ('active','dead','torpor','missing','unknown');
exception when duplicate_object then null; end $$;

alter table public.characters
  add column if not exists life_status character_life_status not null default 'active';

alter table public.characters
  add column if not exists kind_data jsonb not null default '{}'::jsonb;

-- Индекс для фильтрации мертвых/живых
create index if not exists characters_life_status_idx on public.characters(life_status);
