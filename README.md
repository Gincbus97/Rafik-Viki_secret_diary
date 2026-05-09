# Chronicle — Vampire: The Masquerade 5e knowledge base

Совместная база знаний для группы по Vampire: The Masquerade 5th edition.
Персонажи (PC + NPC), направленные типизированные связи, квесты, сессии,
фракции, локации, личные заметки. Multi-user через магическую ссылку на email.

## Стек

- React + TypeScript + Vite
- Tailwind CSS (готическая тёмная тема)
- TanStack Query (кэш и подгрузка)
- Supabase (Postgres + Auth + Storage)
- Vercel (hosting)

## Быстрый старт

См. [DEPLOY.md](./DEPLOY.md) — пошаговая инструкция от 0 до публичной ссылки.

Для локальной разработки:
```
cp .env.example .env.local   # заполни VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Структура

```
supabase/schema.sql         — схема БД и RLS-политики
src/lib/                    — supabase client, типы, AuthProvider
src/components/             — переиспользуемые виджеты (Layout, Slider, стикеры…)
src/pages/                  — экраны (Dashboard, Characters, Quests, …)
```

## Что внутри

- **Дашборд** — недавние персонажи, активные квесты, последние сессии.
- **Персонажи** — список с фильтрами (PC/NPC, клан, секта, поиск), полное досье с шкалами Humanity/Hunger/Reputation, дисциплинами, биографией, заметками. Фильтр связей PC/NPC внутри досье.
- **Связи** — направленные A → B, преднастроенные типы VtM (Sire, Childe, Blood Bond 1/2/3, Ghoul, Boon owed/held, …) + кастомные. Описание, дата, номер сессии, сила.
- **Квесты** — список и Kanban (Active / Completed / Failed), статус по клику, чеклист целей, заказчик, награда, привязка персонажей и локаций.
- **Фракции и Коттери** — состав, лидер, территория, цели.
- **Локации** — типы (haven / Elysium / hunting ground / business), владелец-персонаж или фракция.
- **Сессии** — лента, краткое содержание, события, новые NPC, изменения в связях, участники.
- **Профиль** — имя в чате, скрытие чувствительных полей у чужих персонажей, обзор всех личных заметок.
- **Личные заметки** — видны только автору, привязаны к персонажу.
