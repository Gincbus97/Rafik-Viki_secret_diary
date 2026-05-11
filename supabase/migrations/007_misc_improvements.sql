-- =============================================================================
-- Миграция #007 — несколько небольших улучшений:
--   • reciprocal_name на типах связей (настраиваемая двунаправленность)
--   • иконка фракции
--   • расширение enum location_kind
--   • images jsonb на sessions (галерея)
--   • переименование сетки Церковь Каина → Cathedral of Cain
-- Безопасна для повторного запуска.
-- =============================================================================

-- 1) Reciprocal на типах связей
alter table public.relationship_types
  add column if not exists reciprocal_name text;

-- Бэкфилл из встроенной матрицы
update public.relationship_types set reciprocal_name = 'Childe'         where name = 'Sire'         and reciprocal_name is null;
update public.relationship_types set reciprocal_name = 'Sire'           where name = 'Childe'       and reciprocal_name is null;
update public.relationship_types set reciprocal_name = 'Boon held'      where name = 'Boon owed'    and reciprocal_name is null;
update public.relationship_types set reciprocal_name = 'Boon owed'      where name = 'Boon held'    and reciprocal_name is null;
update public.relationship_types set reciprocal_name = 'Ally'           where name = 'Ally'         and reciprocal_name is null;
update public.relationship_types set reciprocal_name = 'Coterie member' where name = 'Coterie member' and reciprocal_name is null;
update public.relationship_types set reciprocal_name = 'Любовь'         where name = 'Любовь'        and reciprocal_name is null;
update public.relationship_types set reciprocal_name = 'Враг'           where name = 'Враг'          and reciprocal_name is null;
update public.relationship_types set reciprocal_name = 'Соперник'       where name = 'Соперник'      and reciprocal_name is null;

-- 2) Иконка фракции
alter table public.factions
  add column if not exists icon text;

-- 3) Новые виды локаций (enum)
do $$ begin
  alter type location_kind add value if not exists 'police_station';
exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'hospital';       exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'church';         exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'government';     exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'mortuary';       exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'university';     exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'park';           exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'club';           exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'apartment';      exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'warehouse';      exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'restaurant';     exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'safehouse';      exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'cemetery';       exception when others then null; end $$;
do $$ begin alter type location_kind add value if not exists 'subway';         exception when others then null; end $$;

-- 4) Галерея в сессиях (массив URL)
alter table public.sessions
  add column if not exists images jsonb not null default '[]'::jsonb;

-- 5) Переименование секты
update public.characters
   set sect = 'Cathedral of Cain'
 where sect = 'Церковь Каина';
