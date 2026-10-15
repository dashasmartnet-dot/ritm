# Ритм — свой сайт

Приложение «Ритм» без чужих брендов. Это сайт с иконкой и заставкой, который ставится на iPhone как приложение.

```
docs/       сайт: index.html, иконки, заставки, backend.js, config.js
supabase/   база (schema.sql) и функция ИИ (functions/ai/index.ts)
build.py    сборка web/index.html из исходников приложения
```

## Настройка (один раз, ~15 минут)

Ключи и пароли вводишь только ты в настройках сервисов. Мне нужны только адрес проекта и публичный ключ (шаг 2.6).

### 1. GitHub: здесь будет жить сайт
1. Зарегистрируйся на github.com и создай публичный репозиторий `ritm` (New repository → Public → Create).
2. В claude.ai: Настройки → Коннекторы → GitHub → подключи.
   Тогда я смогу сама выкладывать обновления.
3. В репозитории открой Settings → Pages → Source → **GitHub Actions**.

Адрес сайта будет `https://ЛОГИН.github.io/ritm/`. Свой домен можно подключить позже.

### 2. Supabase: вход и хранение дел
1. Зарегистрируйся на supabase.com → New project, имя `ritm`, регион Frankfurt. Пароль базы сохрани у себя.
2. SQL Editor → вставь содержимое `supabase/schema.sql` → Run.
3. Authentication → Emails → шаблон **Magic Link**:
   - тема: `Код входа в Ритм`
   - текст: `Твой код: {{ .Token }}`
4. Edge Functions → Deploy a new function → Via Editor, имя `ai`. Вставь `supabase/functions/ai/index.ts` → Deploy.
5. Edge Functions → Secrets → добавь секрет `ANTHROPIC_API_KEY` с ключом из console.anthropic.com.
   Если там не проходит оплата, используй `OPENROUTER_API_KEY` с ключом с openrouter.ai.
6. Project Settings → API: пришли мне **Project URL** и ключ **anon public**. Они не секретные.

## Как поставить на iPhone
1. Открой адрес сайта в Safari.
2. Нажми «Поделиться» → «На экран Домой» → «Добавить».
3. Запусти Ритм с иконки и войди по коду из письма.
