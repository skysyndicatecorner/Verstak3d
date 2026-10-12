// Верстак 3D — главный процесс Electron (окно, файлы, меню). Лицензия MIT.
'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let win = null;
let dirty = false;
let forceClose = false;
let pendingFile = null;

const isProjectFile = a => typeof a === 'string' && !a.startsWith('-') && /\.(v3d|json)$/i.test(a);
const fileFromArgv = argv => argv.slice(app.isPackaged ? 1 : 2).find(isProjectFile) || null;

// Один экземпляр программы: повторный запуск (например, двойной щелчок по .v3d) открывает файл в уже открытом окне
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const f = fileFromArgv(argv);
    if (f) win.webContents.send('open-file', path.resolve(f));
  });
}

// macOS: открытие файла через Finder
app.on('open-file', (e, p) => {
  e.preventDefault();
  if (win && !win.webContents.isLoading()) win.webContents.send('open-file', p);
  else pendingFile = p;
});

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 960, minHeight: 620,
    title: 'Верстак 3D',
    icon: path.join(__dirname, 'app', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#f3f3f3',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // внешние ссылки — в браузере, переходы внутри окна запрещены
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', e => e.preventDefault());

  win.on('close', e => {
    if (forceClose || !dirty) return;
    e.preventDefault();
    const r = dialog.showMessageBoxSync(win, {
      type: 'question', buttons: ['Сохранить', 'Не сохранять', 'Отмена'], defaultId: 0, cancelId: 2,
      title: 'Верстак 3D', message: 'Сохранить изменения в проекте?', detail: 'Если не сохранить, изменения будут потеряны.',
    });
    if (r === 0) win.webContents.send('menu', 'save-and-close');
    else if (r === 1) { forceClose = true; win.close(); }
  });
  win.on('closed', () => { win = null; });
  buildMenu();
}

function buildMenu() {
  if (process.platform !== 'darwin') { Menu.setApplicationMenu(null); return; } // на Windows и Linux всё в ленте
  const send = cmd => () => win && win.webContents.send('menu', cmd);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Верстак 3D', submenu: [
      { role: 'about', label: 'О программе' }, { type: 'separator' },
      { role: 'hide', label: 'Скрыть' }, { role: 'hideOthers', label: 'Скрыть остальные' }, { type: 'separator' },
      { role: 'quit', label: 'Завершить' },
    ] },
    { label: 'Файл', submenu: [
      { label: 'Создать…', accelerator: 'Cmd+N', click: send('new') },
      { label: 'Открыть…', accelerator: 'Cmd+O', click: send('open') },
      { label: 'Сохранить', accelerator: 'Cmd+S', click: send('save') },
      { label: 'Сохранить как…', accelerator: 'Shift+Cmd+S', click: send('save-as') },
      { type: 'separator' },
      { label: 'Импорт STL…', click: send('import') },
      { label: 'Экспорт…', accelerator: 'Cmd+E', click: send('export') },
    ] },
    { label: 'Правка', submenu: [
      { label: 'Отменить', accelerator: 'Cmd+Z', click: send('undo') },
      { label: 'Повторить', accelerator: 'Shift+Cmd+Z', click: send('redo') },
      { type: 'separator' },
      { role: 'cut', label: 'Вырезать' }, { role: 'copy', label: 'Копировать' }, { role: 'paste', label: 'Вставить' },
      { label: 'Выделить всё', accelerator: 'Cmd+A', click: send('select-all') },
    ] },
    { role: 'windowMenu', label: 'Окно' },
    { label: 'Справка', submenu: [{ label: 'Справка Верстак 3D', accelerator: 'F1', click: send('help') }] },
  ]));
}

ipcMain.handle('save-dialog', async (_e, { defaultPath, filters }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), defaultPath || 'Проект.v3d'), filters });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('open-dialog', async (_e, { filters }) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters, defaultPath: app.getPath('documents') });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return { path: p, name: path.basename(p), data: await fs.readFile(p) };
});
ipcMain.handle('read-file', async (_e, p) => ({ path: p, name: path.basename(p), data: await fs.readFile(p) }));
ipcMain.handle('write-file', async (_e, { path: p, data }) => {
  await fs.writeFile(p, typeof data === 'string' ? data : Buffer.from(data));
  return true;
});
ipcMain.handle('initial-file', () => {
  const f = pendingFile || fileFromArgv(process.argv);
  pendingFile = null;
  return f ? path.resolve(f) : null;
});
ipcMain.handle('app-info', () => ({ version: app.getVersion(), platform: process.platform }));
ipcMain.on('dirty', (_e, v) => { dirty = !!v; if (win && process.platform === 'darwin') win.setDocumentEdited(dirty); });
ipcMain.on('title', (_e, t) => { if (win) win.setTitle(String(t)); });
ipcMain.on('close-ok', () => { forceClose = true; if (win) win.close(); });

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
