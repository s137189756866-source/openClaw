import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_GATEWAY_PORT = Number(process.env.OPENCLAW_GATEWAY_PORT) || 18789;

// IPC handler for sending chat messages to OpenClaw via HTTP Gateway
ipcMain.handle('send-chat', async (_event, payload) => {
  const { message, sessionKey } =
    typeof payload === 'string' ? { message: payload } : payload || {};
  if (!message || !message.trim()) {
    return { success: false, error: '缺少 message' };
  }

  const key = sessionKey || process.env.OPENCLAW_SESSION_KEY || 'agent:main:main';
  if (!key) return { success: false, error: '缺少 sessionKey' };

  try {
    const res = await fetch(`http://localhost:${DEFAULT_GATEWAY_PORT}/api/sessions/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey: key, message }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gateway ${res.status}: ${errText || '未知错误'}`);
    }

    const data = await res.json().catch(async () => ({ reply: await res.text() }));
    const reply =
      data.reply || data.message || data.text || data.content || data?.data?.reply || '';

    return { success: true, data: { reply: (reply || '').trim() } };
  } catch (error) {
    console.error('OpenClaw gateway error:', error);
    return { success: false, error: error.message || '网关调用失败' };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 680,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    show: false, // show after CSS injection to avoid flicker
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = 'http://localhost:5173';

  if (!app.isPackaged) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Make the entire window draggable except explicit no-drag zones.
  win.webContents.on('did-finish-load', () => {
    const dragStyles = `
      html, body { width: 100%; height: 100%; margin: 0; -webkit-app-region: drag; }
      #app, main, header, footer, section { -webkit-app-region: drag; }
      button, input, textarea, select, option, label, a, [data-no-drag], .no-drag { -webkit-app-region: no-drag; }
    `;

    win.webContents.insertCSS(dragStyles);
    // Show after styles are applied to keep the frameless window transparent while dragging.
    if (!win.isVisible()) {
      win.show();
    }
  });
  return win;
}

let tray;
let mainWindow;

const toggleWindow = () => {
  if (!mainWindow) return;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
  updateTrayMenu();
};

const buildTrayIcon = () => {
  // Minimal 16x16 transparent PNG to avoid missing asset issues.
  const transparentPng =
    'iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAHElEQVQ4T2NkYGBg+M+ABYwMjAwMDI4GAAAcqQHCvQfU9wAAAABJRU5ErkJggg==';
  return nativeImage.createFromDataURL(`data:image/png;base64,${transparentPng}`);
};

const updateTrayMenu = () => {
  if (!tray || !mainWindow) return;

  const isVisible = mainWindow.isVisible();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? '隐藏窗口' : '显示窗口',
      click: toggleWindow
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Doraemon AI');
};

const createTray = () => {
  if (tray) return;

  tray = new Tray(buildTrayIcon());
  tray.on('click', toggleWindow);
  tray.on('right-click', () => tray?.popUpContextMenu());

  updateTrayMenu();
};

// Handle restart requests
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit();
});

app.whenReady().then(() => {
  mainWindow = createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      createTray();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
