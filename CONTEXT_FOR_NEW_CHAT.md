# Контекст для нового чата — Vampire Chronicle

> Вставь это в начало нового чата с Claude, чтобы он подхватил работу без потери контекста.

## Что это за проект

Веб-приложение — общая база знаний для нашей группы по настольной ролевой игре **Vampire: The Masquerade 5e**. Игра идёт через Foundry VTT + Discord, приложение живёт отдельно в браузере. 4 игрока + рассказчик, все читают и пишут.

Имя проекта в репо: `vampire-chronicle`. Папка на компьютере: `C:\Users\123\Documents\Claude\Projects\Rafik&Viki_secret_diary`.

Я — **Артём** (zodak97@gmail.com), не программист, нужны пошаговые инструкции.

Эстетика: готическая с милотой («стикерная»), русский интерфейс.

## Технологический стек

- **Frontend:** React 18 + Vite 5 + TypeScript 5.6, single-page app
- **Стили:** Tailwind CSS 3.4, кастомная готическая палитра (`ink`, `crypt`, `velvet`, `bone`, `ash`, `blood`, `bloodlight`, `rose`, `gold`)
- **Данные:** Supabase (Postgres + Auth + Row-Level Security)
- **State / fetching:** TanStack Query 5
- **Роутинг:** react-router-dom 6.27
- **Mind Map:** reactflow 11 (граф связей с кастомными узлами и рёбрами)
- **PDF-экспорт карты:** html-to-image 1.11 + jspdf 2.5
- **Аутентификация:** магическая ссылка на email (Supabase Auth)
- **Деплой:** Vercel (бесплатный тариф, авто-деплой при push в `main`), база — Supabase free tier

## Структура сущностей

- **Characters** — PC и NPC в общей таблице с флагом `is_pc`. Поля: имя, портрет (URL), `kind` (`kindred`/`ghoul`/`human`/`group`), клан, секта, поколение, sire, статус, локация, описание, биография, дисциплины с уровнями, Humanity, Hunger, Bane, Compulsion, Predator Type (убран), `kind_data` JSON (touchstones, blood_bonded_to, herd, mortal_allies, domitor_id и т.д.), `enemies` JSON-массив, `life_status`, `mindmap_x/y` (позиции на карте).
- **Relationships** — направленные типизированные связи. Преднастроены VtM-типы: Sire, Childe, Blood Bond 1/2/3, Ghoul, Coterie member, Boon owed/held, Ally, Enemy, Rival, Lover, Mentor, Knows about + кастомные (Touchstone, Любовь, Ненависть, Доверие, Страх и т.д.). Категория `mechanic` / `personal`. Силу 1–5. Поддержка реципрокных пар (см. `RECIPROCAL` в `src/lib/types.ts`).
- **Factions & Coteries** — название, тип (sect/coterie/cult/package/mortal), описание, лидер, участники, иконка, территория, цели.
- **Locations** — название, тип (haven/Elysium/hunting ground/business/other), владелец, описание.
- **Quests** — статус (Active/Completed/Failed/On Hold), цели-чеклист, награда, заказчик, участники, локации, даты. Kanban с drag-and-drop.
- **Sessions** — номер, дата, краткое содержание, события, NPC, изменения связей, галерея.

## Ключевые экраны

- **Досье персонажа** (`/characters/:id`) — портрет, мини-лист, шкалы, таблица связей с фильтром PC/NPC/все, квесты, фракции.
- **Карта связей / Mind Map** (`/mindmap`) — `src/pages/MindMap.tsx`. Интерактивный граф через React Flow с кастомным узлом `CharacterNode` и кастомным изгибаемым ребром `ChronicleEdge`. Фильтры: только PC, скрыть мёртвых, клан, фракция, сила связи, категория (механика/личное), фокус на одном персонаже с глубиной 1–2 хопа. Кнопки: 🔒 блок/разблок перетаскивания, ↻ авто-раскладка, 📄 экспорт PDF.
- **Квестборд** — Kanban (Active/On Hold/Completed/Failed) с DnD + фильтры.
- **Лента сессий** — хронологический список с галереей.
- **Профиль игрока** (`src/pages/ProfilePage.tsx`) — настройки видимости + личные заметки. **ВАЖНО:** файл правил руками сам Артём, не откатывать.

## Важные файлы

```
src/
  lib/
    supabase.ts          — клиент Supabase
    auth.ts              — контекст авторизации
    types.ts             — типы + константы (CLANS, RECIPROCAL и т.д.)
    relationships.ts     — createRelWithReciprocal: создание связи + реципрока
  pages/
    MindMap.tsx          — карта связей (~1280 строк), главное место правок последних чатов
    CharacterPage.tsx    — досье персонажа
    CharactersList.tsx
    QuestBoard.tsx       — Kanban квестов
    Sessions.tsx
    ProfilePage.tsx      — НЕ ТРОГАТЬ (правил руками)
  components/            — общие компоненты (модалки, формы)
supabase/
  migrations/
    001_*..008_groups_and_enemies.sql
                         — последняя миграция добавляет 'group' в enum creature_kind
                           и колонку enemies jsonb в characters
```

В `package.json`:

```json
"dependencies": {
  "@supabase/supabase-js": "^2.45.0",
  "@tanstack/react-query": "^5.59.0",
  "html-to-image": "^1.11.11",
  "jspdf": "^2.5.2",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.27.0",
  "reactflow": "^11.11.4"
}
```

## Что было сделано в последних чатах

1. **PDF-экспорт карты связей** (`MindMap.tsx` → `exportPdf`): кнопка «📄 Экспорт PDF» на тулбаре карты. Считает bounding box всех узлов через DOM, рендерит React Flow viewport в PNG через `html-to-image` с override transform, вставляет в jsPDF (A4 landscape) с заголовком, датой и списком активных фильтров. Ручки перетаскивания рёбер исключены через `data-export-hide="1"` + `filter` колбэк. Ограничения: латинский шрифт в заголовке PDF (русские подписи на самой карте сохраняются, т.к. они уже в растрированной картинке), CORS-портреты могут ломать рендер.

2. **Сущность Group / Mob** (миграция 008) — добавлен `kind = 'group'` для «Толпы» смертных. На карте отрисовываются золотой двойной рамкой 👥.

3. **Поле `enemies`** в характеристиках — JSON-массив `character_id`. Синтезируются связи `Враг` на карте.

4. **Фикс направления связи PC→NPC** (только что в текущем чате): target-хэндлы на узлах в `CharacterNode` были сверху source-хэндлов в DOM-порядке, пользователь хватал невидимую target-ручку, React Flow в `ConnectionMode.Loose` инвертировал source/target. Решение в `MindMap.tsx`:
   - target-хэндлы рендерятся ПЕРВЫМИ (под source) и получают `pointerEvents: 'none'` + `zIndex: 0`
   - source-хэндлы рендерятся ПОСЛЕДНИМИ и получают `zIndex: 2`
   - target-хэндлы остаются в DOM как «якоря» (по id `t2`/`r2`/`b2`/`l2`) для корректного рисования рёбер через `pickHandles`

5. **Подписи рёбер не наплывают** (только что в текущем чате): рефакторинг `ChronicleEdge` в `MindMap.tsx`:
   - Название типа связи теперь рисуется **вдоль линии** через SVG `<textPath>` + `<defs><path>` с уникальным id, цветом ребра (с тёмной обводкой `paint-order: stroke` для читаемости). Для рёбер «справа-налево» / «снизу-вверх» используется развёрнутый путь, чтобы буквы не были вверх ногами.
   - Описание — в отдельном пузыре, сдвинутом перпендикулярно от середины кривой (≈26px), с левой полоской цвета ребра.
   - В `buildEdge` подписи теперь летят через `data.typeName` и `data.description` раздельно (раньше склеивались в `label`).
   - `sig` для триггера ре-рендера обновлён, чтобы переключатели «показывать типы / описание» сразу применялись.

## Текущее состояние

- **Typecheck чистый** (`npx tsc --noEmit`).
- **Изменения не запушены** — Артём пытается сделать `git push`, но столкнулся с:
  - `git` не найден в PowerShell (но GitHub Desktop установлен в `C:\Users\123\AppData\Local\GitHubDesktop`).
  - `A lock file already exists in the repository` — `.git/index.lock` остался от моих ранних git-операций в песочнице. Решение: удалить файл вручную (`del "C:\Users\123\Documents\Claude\Projects\Rafik&Viki_secret_diary\.git\index.lock"`) и снова жать Commit/Push в GitHub Desktop.

## Известные проблемы / TODO

- **PDF экспорт:** заголовок латиницей, одна A4-страница, CORS-портреты ломают рендер. Если нужны не-латинские заголовки — придётся подключать шрифт в jsPDF.
- **После добавления квеста** раньше требовалась перезагрузка (могло быть пофикшено инвалидацией кеша TanStack Query).
- **PostgREST schema cache:** после миграций иногда нужно вручную в Supabase SQL Editor выполнить `notify pgrst, 'reload schema';`.
- **Реалтайм-синк** не подключён (пока обновляется на reload — было ОК для MVP).

## Предпочтения пользователя (важно для нового Claude)

- Артём **не программист** — нужны пошаговые инструкции (как сделать в GitHub Desktop / в Supabase UI / в Vercel UI), не «команды для терминала», если можно без них.
- Интерфейс — русский, но код и комментарии — смесь русского и английского, как удобнее.
- **Сначала покажи план / стек / подход, дождись «ок», только потом меняй код** (так договаривались изначально).
- Эстетика: готическая с «милотой» — стикерные иконки, мягкие закругления, тёплые акценты на красно-золотой палитре.
- Деплой — бесплатный (Vercel + Supabase free tier).

## Чтобы продолжить работу

Открой новый чат и вставь весь этот файл целиком. Дальше можешь сразу описывать новую задачу или баг — Claude будет понимать, где что лежит и какие конвенции уже устоялись.

Если хочется ещё точнее — попроси Claude перед началом работы прочитать конкретный файл (`Read C:\Users\123\Documents\Claude\Projects\Rafik&Viki_secret_diary\src\pages\MindMap.tsx` и т.п.).
