// Mon Money Tracking - bản PC (Electron, Windows)
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_TITLE = 'Mon Money Tracking';
const HEADER_H = 58;
let win = null;

// ---------- nhớ kích thước / vị trí cửa sổ ----------
const statePath = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch (e) {
    return { width: 1320, height: 820 };
  }
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(statePath(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch (e) {
    /* ignore */
  }
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    title: APP_TITLE,
    x: st.x,
    y: st.y,
    width: st.width || 1320,
    height: st.height || 820,
    minWidth: 1060,
    minHeight: 640,
    backgroundColor: '#1F2126',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    titleBarStyle: 'hidden', // ẩn thanh tiêu đề Windows, header của app làm thanh tiêu đề
    titleBarOverlay: { color: '#1F2126', symbolColor: '#FFFFFF', height: HEADER_H },
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (st.maximized) win.maximize();
  win.setMenu(null);
  win.once('ready-to-show', () => win.show());
  ['resize', 'move', 'close'].forEach((ev) => win.on(ev, saveState));

  // link ngoài (trang Releases...) mở bằng trình duyệt mặc định
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.VITE_DEV_URL) win.loadURL(process.env.VITE_DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// ---------- tự cập nhật (GitHub Releases) ----------
let autoUpdater = null;
function getUpdater() {
  if (autoUpdater) return autoUpdater;
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('download-progress', (p) => win && win.webContents.send('update-progress', p.percent));
  return autoUpdater;
}
ipcMain.handle('update-check', async () => {
  if (!app.isPackaged) return { status: 'latest', version: app.getVersion() };
  try {
    const r = await getUpdater().checkForUpdates();
    const v = r && r.updateInfo && r.updateInfo.version;
    if (v && v !== app.getVersion() && r.isUpdateAvailable !== false) {
      return { status: 'available', version: v, notes: typeof r.updateInfo.releaseNotes === 'string' ? r.updateInfo.releaseNotes : '' };
    }
    return { status: 'latest', version: app.getVersion() };
  } catch (e) {
    // chưa có bản phát hành nào trên GitHub -> coi như đang là bản mới nhất
    if (/404|No published versions|Cannot find latest/i.test(String(e && e.message))) return { status: 'latest', version: app.getVersion() };
    throw e;
  }
});
ipcMain.handle('update-download', async () => {
  await getUpdater().downloadUpdate();
  return true;
});
ipcMain.on('update-install', () => {
  setImmediate(() => getUpdater().quitAndInstall(false, true));
});
ipcMain.handle('app-version', () => app.getVersion());

// chỉ cho chạy 1 cửa sổ app
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.setAppUserModelId('com.mondiro.moneytracking');
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
