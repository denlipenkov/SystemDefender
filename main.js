// Точка входа Electron — создаёт окно приложения и загружает игру.
// Этот файл запускается Node.js, а не браузером.

const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');

// Флаг — запущены ли мы в режиме разработки
const isDev = process.argv.includes('--dev');

// Явно задаём userData/кэши в доступной папке (на Windows это иногда ломается из‑за прав/антивируса).
try {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || app.getPath('appData');
    const userDataDir = path.join(base, 'SystemDefender');
    app.setPath('userData', userDataDir);
    app.commandLine.appendSwitch('disk-cache-dir', path.join(userDataDir, 'Cache'));
    app.commandLine.appendSwitch('gpu-disk-cache-dir', path.join(userDataDir, 'GPUCache'));
  }
} catch (e) {
  // ignore
}

/**
 * Аппаратное ускорение (GPU) для Windows.
 *
 * В Electron рендер и так идёт через GPU при нормальных драйверах, но:
 * - GPU может оказаться в блоклисте/софт-режиме
 * - пользователи могут иметь нестандартные параметры запуска/окружение
 *
 * Эти свитчи направлены на "включить то, что обычно включено" и улучшить
 * шанс на WebGPU/WebGL2 вместо software rasterizer.
 */
try {
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  // Windows: принудительно использовать ANGLE/D3D11 (часто спасает, когда WebGL/WebGPU выключены).
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('use-gl', 'angle');
    app.commandLine.appendSwitch('use-angle', 'd3d11');
  }
  // Попросить Chromium включить WebGPU/Vulkan, если они доступны.
  // (Если фича уже включена по умолчанию — это не мешает.)
  app.commandLine.appendSwitch('enable-features', 'WebGPU,Vulkan');
} catch (e) {
  // ignore
}

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
  try {
    const st = app.getGPUFeatureStatus && app.getGPUFeatureStatus();
    if (st) console.info('[gpu] feature status:', st);
  } catch (e) {
    // ignore
  }

  mainWindow = createGameWindow();

  ipcMain.handle('app-quit', () => {
    app.quit();
  });

  ipcMain.handle('gpu-status', async () => {
    const featureStatus = (app.getGPUFeatureStatus && app.getGPUFeatureStatus()) || null;
    let gpuInfoBasic = null;
    try {
      if (app.getGPUInfo) gpuInfoBasic = await app.getGPUInfo('basic');
    } catch (e) {
      gpuInfoBasic = null;
    }
    return { featureStatus, gpuInfoBasic };
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
