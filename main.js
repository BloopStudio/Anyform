const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const isMac = process.platform === 'darwin';

function createWindow() {
  const win = new BrowserWindow({
    width: 520,
    height: 780,
    minWidth: 420,
    minHeight: 600,
    title: 'Converter',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // ffmpeg.wasm needs SharedArrayBuffer/worker features
    },
  });

  win.loadFile(path.join(__dirname, 'public', 'index.html'));

  // Les liens externes (s'il y en a un jour) s'ouvrent dans le navigateur système,
  // jamais dans une nouvelle fenêtre Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

const menuTemplate = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
        },
      ]
    : []),
  {
    label: 'Édition',
    submenu: [{ role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }],
  },
  {
    label: 'Affichage',
    submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'resetZoom' }],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
