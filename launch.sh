#!/bin/bash
# Скрипт запуска System Defender.
# Сбрасываем ELECTRON_RUN_AS_NODE — он мешает запуску если игру открывают
# из Cursor IDE или другого Electron-приложения.

# Переходим в папку игры (важно — electron ищет package.json в текущей папке)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Запускаем игру
ELECTRON_RUN_AS_NODE=0 ./node_modules/.bin/electron .
