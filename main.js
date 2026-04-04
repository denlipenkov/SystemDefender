// Точка входа Electron — создаёт окно приложения и загружает игру.
// Этот файл запускается Node.js, а не браузером.

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Флаг — запущены ли мы в режиме разработки
const isDev = process.argv.includes('--dev');

// Создаём главное окно игры
function createGameWindow() {
  const gameWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'System Defender: Cyber Warfare',
    backgroundColor: '#050805',   // фон совпадает с цветом игры, нет белой вспышки при старте
    frame: false,                  // убираем системную рамку окна (выглядит как нативное игровое окно)
    resizable: true,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,      // запрещаем Node.js в рендерере — так безопаснее
      contextIsolation: true,      // изолируем контекст — защита от XSS-атак
    },
  });

  // Загружаем HTML-файл игры
  gameWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // В режиме разработки открываем DevTools для отладки
  if (isDev) {
    gameWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Убираем стандартное меню (File/Edit/View...) — в игре оно не нужно
  Menu.setApplicationMenu(null);

  return gameWindow;
}

// Запускаем окно когда Electron готов
app.whenReady().then(() => {
  createGameWindow();

  // На macOS принято восстанавливать окно при клике на иконку в доке
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createGameWindow();
    }
  });
});

// Закрываем приложение когда закрыты все окна (Windows/Linux поведение)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
