import { app, BrowserWindow, ipcMain } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import SSHClient from './sshClient.js';
import StoreManager from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#ffffff',
      height: 32
    },
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolated: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
}

app.commandLine.appendSwitch('no-proxy-server');

app.whenReady().then(() => {
  StoreManager.init();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for Store
ipcMain.handle('store:getConnections', () => {
  return StoreManager.getConnections();
});

ipcMain.handle('store:saveConnection', (event, conn) => {
  return StoreManager.saveConnection(conn);
});

ipcMain.handle('store:deleteConnection', (event, id) => {
  return StoreManager.deleteConnection(id);
});

// IPC Handlers for SSH
ipcMain.handle('ssh:connect', (event, { id, config }) => {
  return SSHClient.connect(id, config, mainWindow);
});

ipcMain.handle('ssh:disconnect', (event, id) => {
  return SSHClient.disconnect(id);
});

ipcMain.handle('ssh:write', (event, { id, data }) => {
  return SSHClient.write(id, data);
});

ipcMain.handle('ssh:resize', (event, { id, cols, rows }) => {
  return SSHClient.resize(id, cols, rows);
});
