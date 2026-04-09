// Точка входа Electron — создаёт окно приложения и загружает игру.
// Этот файл запускается Node.js, а не браузером.

const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');

// Флаг — запущены ли мы в режиме разработки
const isDev = process.argv.includes('--dev');

function applyWindowMode(win, opts) {
  if (!win || win.isDestroyed()) return;
  const mode = opts && opts.mode;
  const width = Math.max(800, Math.min(3840, (opts && opts.width) || 1280));
  const height = Math.max(600, Math.min(2160, (opts && opts.height) || 720));
  try {
    if (mode === 'fullscreen') {
      win.setFullScreen(true);
    } else if (mode === 'borderless') {
      win.setFullScreen(false);
      const d = screen.getPrimaryDisplay();
      const wa = d.workArea || d.bounds;
      win.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height });
    } else {
      win.setFullScreen(false);
      win.setBounds({ width, height });
      win.center();
    }
  } catch (e) {
    console.error('applyWindowMode', e);
  }
}

// Создаём главное окно игры
function createGameWindow() {
  const gameWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'System Defender: Cyber Warfare',
    backgroundColor: '#050805',
    frame: false,
    resizable: true,
    fullscreenable: true,
    fullscreen: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  gameWindow.once('ready-to-show', () => {
    gameWindow.show();
  });

  gameWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (isDev) {
    gameWindow.webContents.openDevTools({ mode: 'detach' });
  }

  Menu.setApplicationMenu(null);

  return gameWindow;
}

let mainWindow = null;

app.whenReady().then(() => {
  mainWindow = createGameWindow();

  ipcMain.handle('app-quit', () => {
    app.quit();
  });

  ipcMain.handle('window-set-mode', (event, opts) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return { ok: false };
    applyWindowMode(win, opts);
    return { ok: true };
  });

  ipcMain.handle('display-work-area', () => {
    const d = screen.getPrimaryDisplay();
    const wa = d.workArea || d.bounds;
    return { width: wa.width, height: wa.height, x: wa.x, y: wa.y, scaleFactor: d.scaleFactor || 1 };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createGameWindow();
    }
  });
});

// Закрываем приложение когда закрыты все окна (Windows/Linux поведение)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
