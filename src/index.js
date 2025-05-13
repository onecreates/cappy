const { app, BrowserWindow, screen, desktopCapturer, ipcMain, session } = require('electron');
const path = require('node:path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let previewWindow; // Keep a global reference
let mainWindow;    // Add a global reference for mainWindow
let isRecording = false; // Track recording state

// Enable screen capture features and hardware acceleration
app.commandLine.appendSwitch('enable-features', 'MediaStream');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('enable-hardware-acceleration');

// Set permissions for screen capture
app.on('ready', () => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'display-capture'];
    callback(allowedPermissions.includes(permission));
  });
});

const createWebcamPreview = () => {
  try {
    previewWindow = new BrowserWindow({
      width: 200,  // Wider for 16:9 aspect ratio
      height: 200,  // Maintains 16:9 ratio at a reasonable size
      alwaysOnTop: true,
      frame: false,
      resizable: false,
      movable: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        enableRemoteModule: false,
        sandbox: true,
        devTools: false, // Disable DevTools
      },
    });
    previewWindow.setMenuBarVisibility(false);
    previewWindow.setMenu(null);
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    previewWindow.setPosition(width - 200, height - 200);
    previewWindow.setMenuBarVisibility(false);
    previewWindow.loadFile(path.join(__dirname, 'webcamPreview.html')).then(() => {
      previewWindow.show();
    }).catch(err => {
      console.error('[Main] Error loading webcamPreview.html:', err);
    });
    previewWindow.on('closed', () => {
        previewWindow = null;
    });
  } catch (err) {
    console.error('[Main] Error in createWebcamPreview:', err);
  }
};

const createWindow = () => {
  try {
    console.log('[Main] Creating main window');
    // Get primary display dimensions
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    
    mainWindow = new BrowserWindow({
      width: 1,
      height: 1,
      resizable: true,
      minimizable: true,
      focusable: true,
      show: false, // Don't show until we position it
      frame: true,
      skipTaskbar: false,
      backgroundColor: '#232323',
      center: true, // Center the window on screen
      icon: path.join(__dirname, '../20250512_0950_Capybara Filmmaker Cartoon_simple_compose_01jv1bh6aaf3980pm19f1vc0za.png'),
      webPreferences: {
        backgroundThrottling: false, // Prevent throttling when in background
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        enableRemoteModule: false,
        sandbox: true,
        devTools: false, // Disable DevTools for mainWindow
      },
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(__dirname, 'index.html')).then(() => {
      console.log('[Main] index.html loaded for mainWindow');
      // mainWindow.webContents.openDevTools({ mode: 'detach' }); // Disable auto-opening DevTools
      // After content loads, get container size and resize window
      setTimeout(() => {
        mainWindow.webContents.executeJavaScript(`
          (function() {
            const el = document.querySelector('.container');
            if (!el) return { width: 340, height: 480 };
            const rect = el.getBoundingClientRect();
            // Add 2px for border rounding, 2px for shadow, 2px for possible scrollbars
            return { width: Math.ceil(rect.width) + 4, height: Math.ceil(rect.height) + 4 };
          })();
        `).then(({ width, height }) => {
          if (width && height) {
            const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
            mainWindow.setContentSize(width, height);
            // Center the window on screen
            mainWindow.center();
            mainWindow.show(); // Show window after positioning
            mainWindow.setResizable(false);
          }
        });
      }, 200);
    }).catch(err => {
      console.error('[Main] Error loading index.html:', err);
    });
    // Add a Quit option via globalShortcut (Ctrl+Q) and window close
    const { globalShortcut } = require('electron');
    app.whenReady().then(() => {
      globalShortcut.register('CommandOrControl+Q', () => {
        app.quit();
      });
    });
    mainWindow.on('close', () => {
      app.quit();
    });
  } catch (err) {
    console.error('[Main] Error in createWindow:', err);
  }
};

// Ensure main window stays accessible
if (mainWindow) {
  mainWindow.on('minimize', () => {
    // Prevent minimizing during recording
    if (isRecording) {
      mainWindow.restore();
    }
  });
  mainWindow.on('close', (e) => {
    if (isRecording) {
      e.preventDefault();
      mainWindow.webContents.send('stop-recording');
    }
  });
}

// Handle IPC for desktopCapturer.getSources
ipcMain.handle('DESKTOP_CAPTURER_GET_SOURCES', async (event, opts) => {
  return await desktopCapturer.getSources(opts);
});

// Set up IPC forwarding for set-blur event
const setupIPCForwarding = () => {
  try {
    console.log('[Main] Setting up IPC forwarding for set-blur');
    // Catch-all IPC listener for debugging
    ipcMain.on('any-channel', (event, ...args) => {
      const sender = event.sender === mainWindow.webContents ? 'mainWindow' : event.sender === previewWindow.webContents ? 'previewWindow' : 'unknown';
      console.log(`[IPC] Received IPC message at ${new Date().toISOString()}: Channel: ${event.channel}, Sender: ${sender}, Args:`, ...args);
    });
    // Specific set-blur listener
    ipcMain.on('set-blur', (event, ...args) => {
      const sender = event.sender === mainWindow.webContents ? 'mainWindow' : event.sender === previewWindow.webContents ? 'previewWindow' : 'unknown';
      console.log(`[IPC] Received set-blur at ${new Date().toISOString()}: Sender: ${sender}, Args:`, ...args);
      if (previewWindow && previewWindow.webContents) {
        console.log('[IPC] Forwarding set-blur to previewWindow');
        previewWindow.webContents.send('set-blur', ...args);
        console.log('[IPC] Set-blur event sent to previewWindow');
      } else {
        console.log('[IPC] previewWindow not available for set-blur');
      }
    });
    // Specific set-bgcolor listener
    ipcMain.on('set-bgcolor', (event, ...args) => {
      console.log('[Main] Forwarding set-bgcolor:', ...args);
      if (previewWindow && previewWindow.webContents) {
        previewWindow.webContents.send('set-bgcolor', ...args);
      } else {
        console.log('[Main] previewWindow not available for set-bgcolor');
      }
    });
    console.log('[Main] set-blur IPC listener registered');
  } catch (err) {
    console.error('[Main] Error in setupIPCForwarding:', err);
  }
};

// Add a catch-all for any IPC that might trigger preview window
ipcMain.on('start-recording', (...args) => {
  console.log('[Main][DEBUG] ipcMain.on("start-recording") called', args);
  // createWebcamPreview(); // If this line exists, comment it out to prevent duplicate preview
});

// In main process, listen for these events:
ipcMain.on('start-recording', () => {
  isRecording = true;
  if (mainWindow) mainWindow.setAlwaysOnTop(true);
});

ipcMain.on('stop-recording', () => {
  isRecording = false;
  if (mainWindow) mainWindow.setAlwaysOnTop(false);
});

ipcMain.on('main-window-hide', () => {
  // Don't allow hiding while recording
  if (!isRecording && mainWindow) mainWindow.hide();
});

ipcMain.on('main-window-show', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  try {
    console.log('[Main] App is ready');
    createWindow();
    console.log('[Main] createWindow called');
    createWebcamPreview();
    console.log('[Main] createWebcamPreview called');
    // Make sure the windows are visible and focused
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    setupIPCForwarding();
    console.log('[Main] setupIPCForwarding called');
  } catch (err) {
    console.error('[Main] Error in app.whenReady:', err);
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});