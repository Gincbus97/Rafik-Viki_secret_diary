-- =============================================================================
-- Миграция #003 — категории связей: игровая механика vs личное отношение.
-- Безопасна для повторного запуска.
-- =============================================================================

do $$ begin
  create type relationship_category as enum ('mechanic','personal');
exception when duplicate_object then null; end $$;

alter table public.relationship_types
  add column if not exists category relationship_category not null default 'personal';

-- Перекатегоризируем встроенные типы (если ещё не размечены)
update public.relationship_types
   set category = 'mechanic'
 where name in (
   'Sire','Childe','Blood Bond 1','Blood Bond 2','Blood Bond 3',
   'Ghoul','Coterie member','Boon owed','Boon held','Knows about'
 );

update public.relationship_types
   set category = 'personal'
 where name in ('Ally','Enemy','Rival','Lover','Mentor');

-- Опционально: добавим парочку типичных "личных" связей, если их ещё нет
insert into public.relationship_types (name, is_builtin, category, description) values
  ('Hates',     true, 'personal', 'A despises B'),
  ('Fears',     true, 'personal', 'A is afraid of B'),
  ('Trusts',    true, 'personal', 'A trusts B'),
  ('Distrusts', true, 'personal', 'A does not trust B')
on conflict (name) do nothing;
