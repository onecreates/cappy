const { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu } = require('electron');
const path = require('path'); // Use Node's path module

// Use both preload scripts - the original and diagnostic one
const diagPreloadPath = path.resolve(__dirname, 'diag-preload.js');
const mainPreloadPath = path.resolve(__dirname, 'preload.js');
const fs = require('fs');
console.log('[Main] DEBUG: Using diagnostic preload script path:', diagPreloadPath);
console.log('[Main] DEBUG: Diagnostic preload file exists?', fs.existsSync(diagPreloadPath));
console.log('[Main] DEBUG: Main preload file exists?', fs.existsSync(mainPreloadPath));
// Always set the preload option to the diagnostic preload
const preloadOption = diagPreloadPath;

// Set application icon
const appIconPath = path.resolve(path.dirname(path.dirname(__dirname)), 'assets_task_01jv1bh5axegtva6b64gnqf5cj_1747023639_img_0.ico');

// Create tray icon
let tray = null;

const createTrayIcon = () => {
  if (tray) return; // Don't create if already exists
  
  tray = new Tray(appIconPath);
  tray.setToolTip('Cappy Screen & Webcam Recorder');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => { 
      if (mainWindow) {
        mainWindow.show();
      } else if (!mainWindow) {
        createWindow();
      }
    }},
    { label: 'Toggle Webcam', click: () => {
      if (webcamWindow && webcamWindow.isVisible()) {
        webcamWindow.hide();
      } else if (webcamWindow) {
        webcamWindow.show();
      } else {
        createWebcamWindow();
      }
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); }}
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Show app on clicking the tray icon
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
    } else if (!mainWindow) {
      createWindow();
    }
  });
};

// Extra debug logs for troubleshooting preload issues
console.log('[Main] __dirname:', __dirname);
console.log('[Main] diagPreloadPath:', diagPreloadPath);
console.log('[Main] mainPreloadPath:', mainPreloadPath);
console.log('[Main] index.html path:', path.join(__dirname, 'index.html'));

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
    icon: appIconPath, // Set the application icon
    // Critical for system audio capture
    audioCapturerServiceName: 'Cappy',
    webPreferences: {
      preload: preloadOption,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: true,
      // Add required permissions for desktop capture and system audio
      additionalArguments: [
        '--enable-features=MediaStreamAPI,GetDisplayMedia',
        '--enable-usermedia-screen-capturing',
        '--auto-accept-this-tab-capture',
        '--allow-http-screen-capture'
      ],
      enableWebRTC: true
    }
  });
  
  // Add minimize to tray behavior
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedURL) => {
    console.error('[MainWindow] failed to load:', validatedURL, errorCode, errorDescription);
  });

  // DEBUG: check preload file presence
  console.log('[Main] preloadPath exists:', fs.existsSync(diagPreloadPath));

  // Open DevTools for debugging
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
    // Critical for system audio capture integration
    audioCapturerServiceName: 'Cappy',
    webPreferences: {
      preload: preloadOption,
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webSecurity: true,
      devTools: true,
      // Add required permissions for media capture
      additionalArguments: ['--enable-features=MediaStreamAPI,GetDisplayMedia'],
      enableWebRTC: true
    }
  });

  // Open DevTools for webcam window
  webcamWindow.webContents.once('dom-ready', () => {
    webcamWindow.webContents.openDevTools({ mode: 'detach' });
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
  try {
    console.log('[Main] Handling DESKTOP_CAPTURER_GET_SOURCES with opts:', opts);
    const sources = await desktopCapturer.getSources(opts || {
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 },
      fetchWindowIcons: true
    });
    console.log('[Main] Got sources count:', sources.length);
    
    // Convert source objects to a simpler format that's safe to send over IPC
    const simplifiedSources = sources.map(source => {
      // Log what the source object contains
      console.log('[Main] Source keys:', Object.keys(source));
      
      // Create a minimal object with special system audio IDs
      return {
        id: source.id,
        name: source.name,
        systemAudioId: source.id.replace('screen:', 'audio:')
      };
    });
    
    console.log('[Main] Simplified sources count:', simplifiedSources.length);
    return simplifiedSources;
  } catch (error) {
    console.error('[Main] Error in DESKTOP_CAPTURER_GET_SOURCES:', error);
    return []; // Return empty array instead of throwing to prevent bad IPC
  }
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
  console.log('[Main] Received set-bgcolor event with color:', color);
  
  // FIXED: Create webcam window if it doesn't exist yet
  if (!webcamWindow) {
    console.log('[Main] Creating webcam window since it does not exist');
    webcamWindow = createWebcamWindow();
  }
  
  if (webcamWindow) {
    // FIXED: Ensure webcam window is visible
    webcamWindow.show();
    
    // Add debug log with more info
    console.log('[Main] DEBUG - webcamWindow details:', {
      id: webcamWindow.id,
      isDestroyed: webcamWindow.isDestroyed(),
      isVisible: webcamWindow.isVisible(),
      isMinimized: webcamWindow.isMinimized(),
      isMaximized: webcamWindow.isMaximized()
    });
    
    // Check if window is ready to receive messages
    if (webcamWindow.webContents.isLoading()) {
      console.log('[Main] Webcam window is still loading, will wait for completion');
      webcamWindow.webContents.once('did-finish-load', () => {
        console.log('[Main] Webcam window finished loading, sending color:', color);
        webcamWindow.webContents.send('set-bgcolor', color);
        webcamWindow.webContents.send('set-blur', true);
      });
    } else {
      // FIXED: Wait for window to be ready before sending message
      setTimeout(() => {
        console.log('[Main] Forwarding color to webcam window:', color);
        webcamWindow.webContents.send('set-bgcolor', color);
        
        // Also enable blur effect
        console.log('[Main] Also enabling blur effect');
        webcamWindow.webContents.send('set-blur', true);
      }, 200);
    }
  } else {
    console.warn('[Main] Cannot set background color: webcamWindow is not defined');
  }
});

ipcMain.on('start-recording', () => {
  if (webcamWindow) webcamWindow.setIgnoreMouseEvents(true);
});

ipcMain.on('stop-recording', () => {
  if (mainWindow) mainWindow.show();
  if (webcamWindow) {
    webcamWindow.show();
    webcamWindow.setIgnoreMouseEvents(false); // Re-enable mouse events so the window can be moved again
  }
});

// Handle force kill from renderer when desktop capturer is unavailable
ipcMain.on('force-kill', () => {
  console.error('[Main] Force kill invoked. Exiting app.');
  app.exit(1);
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

// FIXED: Added webcam window drag handlers
ipcMain.on('webcam-drag-start', (event) => {
  console.log('[Main] Webcam drag start received');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    // Make sure window is movable and mouse events are enabled
    win.setMovable(true);
    win.setIgnoreMouseEvents(false);
  }
});

ipcMain.on('webcam-drag-end', (event) => {
  console.log('[Main] Webcam drag end received');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    // Ensure window stays on top
    win.setAlwaysOnTop(true, 'screen-saver', 1);
  }
});

ipcMain.on('reset-webcam-position', (event) => {
  console.log('[Main] Reset webcam position request received');
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  if (webcamWindow) {
    // Reset to bottom right
    const x = width - 250;
    const y = height - 250;
    webcamWindow.setPosition(x, y);
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

// Webcam source selection functionality has been removed

// Main window lifecycle handlers
app.whenReady().then(() => {
  createWindow();
  createTrayIcon();

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