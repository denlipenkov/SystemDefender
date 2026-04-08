# System Defender: Cyber Warfare

Браузерная игра (одна страница). **Точка входа:** [`src/index.html`](src/index.html).

## Запуск

- **Локально:** откройте в браузере `src/index.html` (двойной клик или «Открыть с помощью»). Ресурсы подключаются из `../assets/` относительно этой страницы.
- **Локальный сервер (предпочтительно):** из корня репозитория, например `npx serve .` или `python -m http.server`, затем откройте URL к `src/index.html` — так корректнее работают `fetch` и пути.
- **Electron (опционально):** при установленном Node.js — `npm install` и `npm start`; окно загружает тот же `src/index.html`.
- **GitHub Pages:** workflow собирает каталог `_site`: содержимое `src/` плюс копия [`assets/`](assets/) в `_site/assets/`.

## Структура

| Путь | Назначение |
|------|------------|
| `src/index.html` | Игра, точка входа |
| `src/styles/main.css` | Стили |
| `assets/audio/` | Фоновая музыка `track1.mp3` … `track7.mp3` |
| `assets/graf/` | Векторное лого и др. графика |

Удалён устаревший дубликат `SystemDefender1.2.html`. Вспомогательный скрипт: [`tools/strip_embedded_assets.py`](tools/strip_embedded_assets.py) — удаляет встроенные base64-константы из HTML (одноразово / при откате).
