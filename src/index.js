const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('node:path');

// Resolve preload script path once
const preloadPath = path.join(__dirname, 'preload.js');

// Set up logging
const enableLogging = () => {
    const logToConsole = (...args) => {
        const logStr = args.map(arg => {
            if (typeof arg === 'object') {
                return JSON.stringify(arg, null, 2);
            }
            return String(arg);
        }).join(' ');
        console.log(logStr);
    };

    console.log('[Main] Electron app starting...');
    
    // Handle renderer console messages
    ipcMain.on('console', (event, method, ...args) => {
        console[method]('[Renderer]', ...args);
    });

    // Log uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('[Main] Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('[Main] Unhandled Rejection at:', promise, 'reason:', reason);
    });
};

enableLogging();

let mainWindow = null;
let webcamWindow = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 620,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: true,
      sandbox: false
    }
  });

  // Open DevTools by default
  mainWindow.webContents.openDevTools({ mode: 'detach' });
  
  // Remove default menu
  mainWindow.setMenu(null);

  mainWindow.loadFile(path.join(__dirname, 'index.html'))
    .then(() => {
      console.log('Window loaded successfully');
      mainWindow.show();
      // Create webcam window by default
      createWebcamWindow();
    })
    .catch(err => {
      console.error('Failed to load window:', err);
    });
};

const createWebcamWindow = () => {
  if (webcamWindow) {
    webcamWindow.show();
    return webcamWindow;
  }
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  webcamWindow = new BrowserWindow({
    width: 230,
    height: 230,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    x: width - 250,  // Position from right
    y: height - 250, // Position from bottom
    movable: true,  // Enable window dragging
    hasShadow: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webSecurity: true,
      devTools: true,
      sandbox: false
    }
  });

  webcamWindow.loadFile(path.join(__dirname, 'webcamPreview.html'));
  webcamWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  webcamWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  
  // Handle dragging behavior
  webcamWindow.on('will-move', () => {
    webcamWindow.setMovable(true);
    webcamWindow.setIgnoreMouseEvents(false);
  });

  webcamWindow.on('moved', () => {
    webcamWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  });

  return webcamWindow;
};

// IPC Handlers
ipcMain.handle('DESKTOP_CAPTURER_GET_SOURCES', async (event, opts) => {
  const sources = await desktopCapturer.getSources(opts);
  return sources;
});

// Add drag end handler
ipcMain.on('drag-end', () => {
  isDragging = false;
});

ipcMain.on('main-window-hide', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('main-window-show', () => {
  if (mainWindow) mainWindow.show();
});

ipcMain.on('toggle-webcam', (event, enabled) => {
  if (enabled) {
    if (!webcamWindow) {
      createWebcamWindow();
    } else {
      webcamWindow.show();
    }
  } else {
    if (webcamWindow) {
      webcamWindow.hide();
    }
  }
});

ipcMain.on('set-blur', (event, enabled) => {
  if (webcamWindow) {
    webcamWindow.webContents.send('set-blur', enabled);
  }
});

ipcMain.on('set-blur-strength', (event, strength) => {
  if (webcamWindow) {
    webcamWindow.webContents.send('set-blur-strength', strength);
  }
});

ipcMain.on('set-bgcolor', (event, color) => {
  if (webcamWindow) {
    webcamWindow.webContents.send('set-bgcolor', color);
  }
});

ipcMain.on('start-recording', () => {
  if (webcamWindow) webcamWindow.setIgnoreMouseEvents(true);
});

ipcMain.on('stop-recording', () => {
  if (mainWindow) mainWindow.show();
  if (webcamWindow) webcamWindow.show();
});

// Webcam window management
ipcMain.handle('toggle-webcam', (event, shouldShow) => {
  if (shouldShow) {
    createWebcamWindow();
  } else if (webcamWindow) {
    webcamWindow.hide();
  }
});

ipcMain.handle('hide-webcam', () => {
  if (webcamWindow) {
    webcamWindow.hide();
  }
});

ipcMain.handle('show-webcam', () => {
  if (webcamWindow) {
    webcamWindow.show();
  } else {
    createWebcamWindow();
  }
});

// Window dragging handlers
ipcMain.handle('set-ignore-mouse-events', (event, ...args) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setIgnoreMouseEvents(...args);
  }
});

ipcMain.handle('reset-webcam-position', () => {
  if (webcamWindow) {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    // Reset to bottom right
    const x = width - 250;
    const y = height - 250;
    webcamWindow.setPosition(x, y);
  }
});

// Main window lifecycle handlers
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  // Add main window close handler after window is created
  if (mainWindow) {
    mainWindow.on('close', () => {
      console.log('Main window closing, cleaning up webcam window...');
      if (webcamWindow) {
        webcamWindow.destroy();
        webcamWindow = null;
      }
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app quit
app.on('before-quit', () => {
  console.log('App quitting, cleaning up windows...');
  if (webcamWindow) {
    webcamWindow.removeAllListeners('close');
    webcamWindow.destroy();
    webcamWindow = null;
  }
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
});