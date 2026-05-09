# Деплой Chronicle — пошагово для не-программиста

Цель: получить публичную ссылку вида `https://chronicle-vampires.vercel.app`, которой ты поделишься с группой. Стоимость: **0 ₽/мес** на старте.

Понадобится 3 аккаунта (бесплатные):
1. **GitHub** — где будет жить код
2. **Supabase** — база данных + авторизация по email
3. **Vercel** — где приложение будет работать

Время: ~25–35 минут, если делаешь впервые.

---

## Шаг 0. Установи 2 программы (один раз в жизни)

1. **Node.js LTS** — для сборки проекта.
   Скачай с [nodejs.org](https://nodejs.org), нажми Install с настройками по умолчанию. Перезагрузи компьютер если попросит.
2. **GitHub Desktop** — чтобы загружать код без командной строки.
   Скачай с [desktop.github.com](https://desktop.github.com), установи, в нём войди в свой GitHub-аккаунт (создай если нет на github.com).

---

## Шаг 1. Создай проект в Supabase (~5 минут)

1. Зайди на [supabase.com](https://supabase.com), нажми **Start your project** → войди через Google или email.
2. Нажми **New project**.
3. Заполни:
   - **Name**: `vampire-chronicle` (или любое)
   - **Database password**: придумай сложный, **запиши себе** (понадобится только если будешь копаться в БД руками — для приложения не нужен)
   - **Region**: ближайший (Frankfurt/Stockholm если ты в Европе, Singapore если Азия)
   - План: **Free**
4. Нажми **Create new project** и подожди 1–2 минуты, пока БД поднимется.

### 1.1. Залей схему БД
1. В левом меню Supabase: **SQL Editor** → **New query**.
2. Открой файл `supabase/schema.sql` из этой папки в любом текстовом редакторе (например, Блокнот), **выдели всё (Ctrl+A) → Ctrl+C**.
3. Вставь в SQL Editor (Ctrl+V).
4. Нажми зелёную кнопку **Run** (или Ctrl+Enter).
5. Внизу должно появиться `Success. No rows returned`. Если ошибки — пришли мне текст, разберёмся.

### 1.2. Настрой авторизацию по email
1. В Supabase левое меню: **Authentication** → **Providers**.
2. Найди **Email** → должно быть `Enabled: ON`. Внутри:
   - **Confirm email**: можешь выключить (тогда первый вход — сразу через ссылку, без отдельного "подтвердите email"). Для приватной группы — это удобнее.
   - **Enable Magic Link**: ON (обычно по умолчанию).
3. **Authentication** → **URL Configuration**:
   - **Site URL**: пока поставь `http://localhost:5173` (потом заменишь на адрес Vercel).
   - **Redirect URLs**: добавь `http://localhost:5173/**` через **Add URL**. Vercel-адрес добавим в шаге 4.

### 1.3. Скопируй ключи
1. **Settings (шестерёнка) → API**.
2. Открой блокнот и сохрани туда:
   - `Project URL` (что-то вроде `https://abcdef.supabase.co`) → это `VITE_SUPABASE_URL`
   - `Project API keys → anon public` (длинная строка `eyJ...`) → это `VITE_SUPABASE_ANON_KEY`
   
   ⚠️ Никогда не копируй `service_role` ключ — он секретный и в коде ему не место.

---

## Шаг 2. Положи проект на GitHub (~5 минут)

1. Открой **GitHub Desktop** → **File → Add Local Repository** → выбери эту папку (`Rafik&Viki_secret_diary`).
2. Если он скажет «not a git repository» → **create a repository** → имя `vampire-chronicle`, **Initialize this repository with README**: выкл, **Private**: на твой вкус (Private — никто не увидит твой код).
3. Нажми **Publish repository** (вверху). Снимай галочку «Keep this code private» если хочешь, чтобы группа могла видеть код. Это безопасно, потому что секретные ключи в `.env.local` и не попадают в git.

---

## Шаг 3. Подключи Vercel (~5 минут)

1. Зайди на [vercel.com](https://vercel.com) → **Sign up with GitHub**.
2. Разреши Vercel доступ к твоему GitHub.
3. Нажми **Add New → Project**.
4. Найди свой репозиторий `vampire-chronicle` → **Import**.
5. **Framework Preset** должен сам определиться как **Vite**. Если нет — выбери Vite вручную.
6. Раскрой **Environment Variables** и добавь два значения (из шага 1.3):
   - Name: `VITE_SUPABASE_URL`         Value: твой Project URL
   - Name: `VITE_SUPABASE_ANON_KEY`    Value: твой anon public ключ
7. Нажми **Deploy**.
8. Через 1–2 минуты получишь зелёный экран и адрес типа `https://vampire-chronicle-xxxx.vercel.app`. Скопируй его.

---

## Шаг 4. Обнови URL в Supabase (важно!)

Чтобы магическая ссылка из письма открывалась в твоём приложении, а не на `localhost`:

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL**: вставь свой Vercel-адрес, например `https://vampire-chronicle-xxxx.vercel.app`.
3. **Redirect URLs**: добавь обе строки:
   - `https://vampire-chronicle-xxxx.vercel.app`
   - `https://vampire-chronicle-xxxx.vercel.app/**`
4. Сохрани.

---

## Шаг 5. Первый вход и приглашение группы

1. Открой свою Vercel-ссылку.
2. Введи свой email (`zodak97@gmail.com`) → нажми «Прислать магическую ссылку».
3. Открой почту, кликни ссылку — попадёшь в приложение.
4. Создай первого персонажа. Если получилось — можно звать остальных.
5. **Чтобы пригласить друга**: просто скажи ему «зайди по ссылке `https://...vercel.app`, введи свой email, кликни ссылку из письма». Никаких аккаунтов отдельно создавать не надо — Supabase сам сделает аккаунт по первому входу.

⚠️ Если у кого-то «не приходит письмо»: пусть проверит «Спам». Бесплатный лимит у Supabase — 30 писем/час, для группы из 5 человек хватит за глаза.

---

## Шаг 6. Локальная разработка (опционально)

Если захочешь запустить у себя на компьютере, чтобы что-то поменять:

1. Открой папку проекта в **Командной строке** (Win+R → `cmd` → `cd` в папку).
2. Скопируй `.env.example` → `.env.local`. Открой и вставь те же 2 ключа из шага 1.3.
3. Выполни:
   ```
   npm install
   npm run dev
   ```
4. Открой `http://localhost:5173`. Меняй файлы — обновляется само.

---

## Что дальше

Когда захочешь добавить:
- **Mind Map** (визуальный граф связей)
- **Загрузку портретов** (вместо URL-ов)
- **Полноценную Kanban-доску квестов с drag-and-drop**

— я добавлю это в следующих итерациях. Структура БД уже готова к этому.

## Куда нажать, если что-то сломалось

| Что вижу | Куда смотреть |
|---|---|
| «Не приходит магическое письмо» | Спам / Supabase Authentication → Logs |
| Ошибка при сохранении: «row-level security…» | Скорее всего пользователь не залогинен. Перезайди. |
| После деплоя пустой белый экран | Vercel → Deployments → последний → View logs. Проверь, что обе env-переменные заданы и начинаются с `VITE_`. |
| «relationship_types violates foreign key» | Прогони SQL заново — он идемпотентен (можно запускать повторно). |

Удачи в Хронике 🩸
