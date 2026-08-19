const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Sert à adapter le menu applicatif et le comportement de fermeture des fenêtres
// aux conventions macOS (menu "app name" dédié, app qui reste active dock icon).
const isMac = process.platform === 'darwin';

app.setName('Anyform');

// Le téléchargement de la mise à jour se fait silencieusement en arrière-plan dès
// qu'elle est détectée : l'utilisateur n'est sollicité qu'au moment de l'installer
// (voir le dialogue sur 'update-downloaded' ci-dessous), pas pour autoriser le
// téléchargement lui-même. autoInstallOnAppQuit garantit que si l'utilisateur ignore
// le dialogue et ferme l'app normalement, la mise à jour s'applique quand même.
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

/**
 * Une mise à jour a fini de se télécharger en arrière-plan : on demande confirmation
 * avant de redémarrer, pour ne pas couper l'utilisateur en pleine conversion. Le choix
 * "Plus tard" (cancelId, touche Échap) laisse l'app tourner telle quelle — l'installation
 * se fera de toute façon à la prochaine fermeture grâce à autoInstallOnAppQuit.
 */
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

/**
 * Une mise à jour ratée (réseau, release corrompue, etc.) ne doit jamais bloquer ou
 * crasher l'app : on se contente de logger, l'utilisateur continue avec la version
 * actuelle et une nouvelle tentative aura lieu au prochain lancement.
 */
autoUpdater.on('error', (err) => {
  console.error('Erreur de mise à jour automatique :', err);
});

/**
 * Crée la fenêtre principale et sa configuration de sécurité. La page chargée est le
 * même bundle client-side que la version web (public/index.html) : elle ne doit donc
 * jamais avoir accès direct à Node.js, d'où contextIsolation + nodeIntegration désactivé
 * et un preload volontairement vide (voir preload.js). autoHideMenuBar masque la barre
 * de menu par défaut car l'app n'a pas besoin d'un menu visible en permanence (accessible
 * via Alt sous Windows/Linux, toujours visible en haut d'écran sous macOS).
 */
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
      // Isole le contexte JS de la page de celui du preload : le renderer ne peut
      // récupérer aucune référence Node.js même si preload.js en manipule un jour.
      contextIsolation: true,
      // Aucune API Node (fs, require, etc.) exposée à la page — cohérent avec le fait
      // que le convertisseur tourne entièrement dans le navigateur (ffmpeg.wasm côté client).
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

// Convention macOS : le premier menu doit porter le nom de l'app (avec "À propos"
// et "Quitter") — Windows/Linux n'ont pas cet usage, d'où le menu conditionnel.
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

// Point d'entrée : Electron ne permet de créer des fenêtres/menus qu'une fois le
// cycle de vie de l'app initialisé, d'où l'attente de whenReady() avant tout.
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  createWindow();
  checkForUpdates();

  // Convention macOS : cliquer sur l'icône du dock doit rouvrir une fenêtre si l'app
  // tourne encore sans fenêtre ouverte (cf. window-all-closed qui ne quit pas sous mac).
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

/**
 * Sous macOS, une app reste active dans le dock même sans fenêtre ouverte (l'utilisateur
 * quitte explicitement via Cmd+Q ou le menu) — on ne quitte donc que sur les autres OS,
 * où fermer la dernière fenêtre équivaut à fermer l'application.
 */
app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
