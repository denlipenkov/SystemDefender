// Preload-скрипт запускается до загрузки страницы игры.
// Здесь можно безопасно передавать API из Node.js в браузерный контекст.
// Пока файл пустой — нужен для правильной настройки contextIsolation.
// В будущем сюда можно добавить bridge для Steam API (greenworks).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  version: process.env.npm_package_version || '1.2.0',
  platform: process.platform,
  quitApp: () => ipcRenderer.invoke('app-quit'),
  setWindowMode: (opts) => ipcRenderer.invoke('window-set-mode', opts),
  getWorkArea: () => ipcRenderer.invoke('display-work-area'),
});
