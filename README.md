# System Defender: Cyber Warfare

Браузерная игра в одном HTML-документе с логикой на JavaScript и стилями в [`src/styles/main.css`](src/styles/main.css). Ресурсы (аудио, SVG, видео заставки) лежат в [`assets/`](assets/).

## Точка входа

- **Игра:** [`src/index.html`](src/index.html)
- **Корень репозитория:** [`index.html`](index.html) — редирект на `src/index.html` (удобно при открытии репозитория как сайта)

## Запуск

### Браузер

1. **Файл напрямую:** откройте `src/index.html` (двойной клик). Пути к `assets/` рассчитаны относительно этой страницы (`../assets/`).
2. **Локальный сервер (рекомендуется):** из корня репозитория, например `npx serve .` или `python -m http.server`, затем откройте URL к `src/index.html` — так стабильнее работают `fetch` и относительные пути.

### Electron (десктоп)

Нужен [Node.js](https://nodejs.org/). В корне:

```bash
npm install
npm start
```

Окно Electron загружает ту же игру (`src/index.html` через `main.js`). Сборки под платформы: скрипты `build:*` в [`package.json`](package.json).

### GitHub Pages

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) при пуше в ветку **`dev`** (или вручную через *workflow_dispatch*) собирает статический сайт: содержимое `src/` в `_site/` и копию [`assets/`](assets/) в `_site/assets/`. Публикация через GitHub Pages из артефакта.

## Структура проекта

| Путь | Назначение |
|------|------------|
| [`src/index.html`](src/index.html) | Игра: разметка, сценарии, игровая логика |
| [`src/styles/main.css`](src/styles/main.css) | Стили UI и экранов |
| [`src/music/adaptive-bgm.js`](src/music/adaptive-bgm.js) | Адаптивная фоновая музыка |
| [`src/render/`](src/render/) | Слой боя (Pixi.js и др.), см. [`src/render/GPU_REQUIREMENTS.md`](src/render/GPU_REQUIREMENTS.md) |
| [`assets/audio/`](assets/audio/) | Треки `track1.mp3` … `track7.mp3`, `music-segments.json` |
| [`assets/graf/`](assets/graf/) | SVG схем управления, лого и видео заставки |
| [`main.js`](main.js) / [`preload.js`](preload.js) | Точка входа Electron, IPC |
| [`tools/strip_embedded_assets.py`](tools/strip_embedded_assets.py) | Удаление встроенных base64 из HTML (сервисный скрипт) |
| [`tools/analyze-music-segments.mjs`](tools/analyze-music-segments.mjs) | Анализ музыки для сегментов (`npm run analyze-music`) |

## Разработка

Зависимости для Electron и сборки описаны в [`package.json`](package.json). Каталог `notuse/` не участвует в обычной сборке и может содержать черновики и вспомогательные файлы.
