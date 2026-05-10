-- =============================================================================
-- Миграция #006 — визуальные настройки типов связей и скрытие механики из manual UI
-- Безопасна для повторного запуска.
-- =============================================================================

-- 1) Визуальные поля
alter table public.relationship_types
  add column if not exists color text default '#a89c9b',
  add column if not exists dashed boolean,
  add column if not exists thickness real default 1.0,
  add column if not exists hidden_from_manual boolean default false;

-- Дефолт для пунктира: личное = пунктир, механика = сплошная
update public.relationship_types
   set dashed = (category = 'personal')
 where dashed is null;

-- Цвета по типам (на основе текущей логики, сохранённые в БД)
update public.relationship_types set color = '#c0233a' where lower(name) in ('sire','childe');
update public.relationship_types set color = '#8a0e1a' where lower(name) like 'blood bond%';
update public.relationship_types set color = '#d8536e' where lower(name) in ('ghoul','любовь','lover');
update public.relationship_types set color = '#dcd0e3' where lower(name) in ('touchstone','coterie member');
update public.relationship_types set color = '#7a1a1a' where lower(name) in ('враг','enemy','ненависть','hates');
update public.relationship_types set color = '#c8a96a' where lower(name) in ('соперник','rival','boon owed','boon held','knows about');
update public.relationship_types set color = '#a89c9b' where lower(name) in ('ally','наставник','mentor','доверие','trusts');
update public.relationship_types set color = '#5b4a6e' where lower(name) in ('страх','fears','недоверие','distrusts');

-- 2) Прячем "чисто механические" типы из ручного добавления —
--    они теперь живут как поля персонажа и синтезируются на карте.
update public.relationship_types
   set hidden_from_manual = true
 where name in (
   'Sire','Childe','Blood Bond 1','Blood Bond 2','Blood Bond 3',
   'Ghoul','Touchstone','Coterie member'
 );

-- 3) Best-effort: миграция старых "Sire" связей из relationships → characters.sire_id.
--    Если у childe ещё нет sire_id — берём из существующей связи.
update public.characters c
   set sire_id = r.from_character_id
  from public.relationships r
  join public.relationship_types t on t.id = r.type_id
 where r.to_character_id = c.id
   and t.name = 'Sire'
   and c.sire_id is null;
