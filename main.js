const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isMac = process.platform === 'darwin';

app.setName('Anyform');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Ne vérifie les mises à jour que sur un build packagé et publié via GitHub Releases —
// en dev (npm start), il n'y a ni app-update.yml ni release à comparer.
function checkForUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Vérification de mise à jour échouée :', err);
  });
}

autoUpdater.on('update-downloaded', (info) => {
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Mise à jour disponible',
      message: `Anyform ${info.version} a été téléchargé.`,
      detail: "L'application va redémarrer pour terminer l'installation.",
      buttons: ['Redémarrer maintenant', 'Plus tard'],
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
});

autoUpdater.on('error', (err) => {
  console.error('Erreur de mise à jour automatique :', err);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 800,
    minWidth: 420,
    minHeight: 600,
    title: 'Anyform',
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
  checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
