// Preload-скрипт запускается до загрузки страницы игры.
// Здесь можно безопасно передавать API из Node.js в браузерный контекст.
// Пока файл пустой — нужен для правильной настройки contextIsolation.
// В будущем сюда можно добавить bridge для Steam API (greenworks).

const { contextBridge } = require('electron');

// Передаём в игру версию приложения — полезно для отображения в меню/настройках
contextBridge.exposeInMainWorld('electronAPI', {
  version: process.env.npm_package_version || '1.2.0',
  platform: process.platform,   // 'win32', 'darwin', 'linux'
});
