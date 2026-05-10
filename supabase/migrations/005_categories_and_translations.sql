-- =============================================================================
-- Миграция #005 — перекатегоризация и русские названия для личных связей
-- Безопасна для повторного запуска: проверяет наличие до апдейта/инсерта.
-- =============================================================================

-- 1) Touchstone — добавляем как механику (one-way: вампир → его смертный якорь)
insert into public.relationship_types (name, is_builtin, category, description)
values ('Touchstone', true, 'mechanic', 'A''s Humanity anchor (mortal touchstone)')
on conflict (name) do update set category = 'mechanic', is_builtin = true;

-- 2) Ally теперь механика (политические/боевые союзники, не личное "приятели")
update public.relationship_types
   set category = 'mechanic'
 where name = 'Ally';

-- 3) Перевод личных типов на русский — переименовываем строки если новое имя свободно
do $$
declare
  pair record;
begin
  for pair in
    select * from (values
      ('Lover',     'Любовь'),
      ('Enemy',     'Враг'),
      ('Rival',     'Соперник'),
      ('Mentor',    'Наставник'),
      ('Hates',     'Ненависть'),
      ('Fears',     'Страх'),
      ('Trusts',    'Доверие'),
      ('Distrusts', 'Недоверие')
    ) as t(old_name, new_name)
  loop
    if exists (select 1 from public.relationship_types where name = pair.old_name)
       and not exists (select 1 from public.relationship_types where name = pair.new_name) then
      update public.relationship_types
         set name = pair.new_name
       where name = pair.old_name;
    end if;
  end loop;
end $$;
