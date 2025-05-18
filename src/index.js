const { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu } = require('electron');
const path = require('path'); // Use Node's path module

// Use only the main preload script to avoid conflicts
const mainPreloadPath = path.resolve(__dirname, 'preload.js');
const fs = require('fs');
console.log('[Main] __dirname:', __dirname);
console.log('[Main] mainPreloadPath:', mainPreloadPath);
console.log('[Main] Main preload file exists?', fs.existsSync(mainPreloadPath));
// Set the preload option to the main preload
const preloadOption = mainPreloadPath;

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
console.log('[Main] preloadOption:', preloadOption);
console.log('[Main] index.html path:', path.join(__dirname, 'index.html'));
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

const createWindow = () => {  mainWindow = new BrowserWindow({
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
      devTools: process.env.NODE_ENV === 'development',
      // Add required permissions for desktop capture and system audio
      additionalArguments: [
        '--enable-features=MediaStreamAPI,GetDisplayMedia',
        '--enable-usermedia-screen-capturing',
        //'--auto-accept-this-tab-capture',
        '--allow-http-screen-capture'
      ],
      enableWebRTC: true
    }
  });
  
  // Only open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedURL) => {
    console.error('[MainWindow] failed to load:', validatedURL, errorCode, errorDescription);
  });

  // DEBUG: check preload file presence
  console.log('[Main] preloadPath exists:', fs.existsSync(preloadOption));
  // Add error handling for crashed events
  mainWindow.webContents.on('crashed', (event) => {
    console.error('[MainWindow] Renderer process crashed!');
    // Handle the crash - recreate the window after a short timeout
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.destroy();
        mainWindow = null;
        createWindow();
      }
    }, 1000);
  });  
  
  // Remove default menu
  mainWindow.setMenu(null);

  mainWindow.loadFile(path.join(__dirname, 'index.html'))    .then(() => {
      console.log('Window loaded successfully');
      mainWindow.show();
      // Create webcam window by default
      createWebcamWindow();
      
      // Add close handler to properly clean up webcam window when main window is closed
      mainWindow.on('close', (event) => {
        console.log('[Main] Main window closing, cleaning up webcam window...');
        // Add a small delay to ensure webcam cleanup is handled before app exit
        if (webcamWindow && !webcamWindow.isDestroyed()) {
          try {
            // Send message to stop the webcam stream before destroying
            webcamWindow.webContents.send('stop-webcam');
            // Small delay to let the webcam cleanup happen
            setTimeout(() => {
              if (webcamWindow && !webcamWindow.isDestroyed()) {
                webcamWindow.destroy();
                webcamWindow = null;
              }
            }, 100);
          } catch (err) {
            console.error('[Main] Error during webcam cleanup:', err);
            if (webcamWindow) {
              webcamWindow.destroy();
              webcamWindow = null;
            }
          }
        }
      });
    })
    .catch(err => {
      console.error('Failed to load window:', err);
    });
};

const createWebcamWindow = () => {  if (webcamWindow) {
    webcamWindow.setTitle(''); // Ensure title is empty
    webcamWindow.setSkipTaskbar(true); // Ensure it doesn't appear in taskbar
    webcamWindow.setMenuBarVisibility(false); // Hide menu bar
    webcamWindow.setAutoHideMenuBar(true); // Auto-hide menu bar
    webcamWindow.show();
    if (process.env.NODE_ENV === 'development') {
      webcamWindow.webContents.openDevTools();
    }
    return webcamWindow;
  }
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;  webcamWindow = new BrowserWindow({
    width: 230,
    height: 230,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    autoHideMenuBar: true,
    closeable: false,
    minimizable: false,
    maximizable: false,
    title: '',
    transparent: true,
    backgroundColor: '#00FFFFFF', // Completely transparent background
    opacity: 1.0,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    roundedCorners: false,
    thickFrame: false,
    paintWhenInitiallyHidden: false, // Prevent initial paint artifacts
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
      devTools: false,
      // Add required permissions for media capture
      additionalArguments: ['--enable-features=MediaStreamAPI,GetDisplayMedia'],
      enableWebRTC: true
    }
  });
  // Open DevTools for webcam window only in development  // Open DevTools for webcam window
  webcamWindow.webContents.once('dom-ready', () => {
    webcamWindow.webContents.openDevTools({ mode: 'detach' });
  });
    // Load the webcam preview with proper initialization
  webcamWindow.once('ready-to-show', () => {
    webcamWindow.setTitle(''); // Ensure title is empty
    webcamWindow.setBackgroundColor('#00FFFFFF'); // Set transparent background color
    webcamWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    webcamWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    
    // Hide any traces of Chrome frame with CSS
    webcamWindow.webContents.insertCSS(`
      * {
        background: transparent !important;
      }
      
      .title-bar, .caption-area, .header, 
      *[class*="title"], *[id*="title"],
      *[class*="frame"], *[id*="frame"],
      *[class*="header"], *[id*="header"] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        opacity: 0 !important;
        background: transparent !important;
      }
    `);
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
  
  // Add content-rendered handler to fix appearance when window content is ready
  webcamWindow.webContents.on('did-finish-navigate', () => {
    console.log('[Main] Webcam window finished navigating, applying fixes');
    
    // Apply a slight delay to ensure the DOM is fully loaded
    setTimeout(() => {
      webcamWindow.webContents.send('set-window-transparent');
      webcamWindow.webContents.send('remove-title-bar');
      webcamWindow.webContents.send('fix-window-position');
    }, 100);
  });
  
  // Add closed event handler to prevent webcam window orphaning
  webcamWindow.on('closed', () => {
    console.log('[Main] Webcam window was closed');
    webcamWindow = null;
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

// Remove the first handler (lines 298-317)
// Keep only this improved version:
ipcMain.on('toggle-webcam', (event, enabled) => {
  console.log('[Main] Toggle webcam with enabled:', enabled);

  if (enabled) {
    // Show webcam
    if (!webcamWindow || webcamWindow.isDestroyed()) {
      // Create new window if it doesn't exist or was destroyed
      console.log('[Main] Creating new webcam window');
      createWebcamWindow();
    } else {
      // Show existing window and bring to front
      console.log('[Main] Showing existing webcam window');
      
      // IMPORTANT: Reload the webcam preview to reset initialization
      webcamWindow.webContents.reload();
      
      // Wait for the reload to complete before showing the window
      webcamWindow.webContents.once('did-finish-load', () => {
        // Force window fixes after reload
        setTimeout(() => {
          webcamWindow.webContents.send('fix-window-position');
          webcamWindow.show();
          webcamWindow.setAlwaysOnTop(true, 'screen-saver', 1);
          
          // Force transparency and removal of title bar
          webcamWindow.setBackgroundColor('#00000000');
          webcamWindow.webContents.send('set-window-transparent');
          webcamWindow.webContents.send('remove-title-bar');
        }, 50);
      });
    }
  } else {    // Hide webcam and stop the stream
    if (webcamWindow && !webcamWindow.isDestroyed()) {
      console.log('[Main] Stopping webcam stream and hiding window');
      // Send message to stop the webcam stream before hiding the window
      webcamWindow.webContents.send('stop-webcam');
      
      // Add a small delay to ensure the webcam is fully stopped before hiding
      setTimeout(() => {
        if (webcamWindow && !webcamWindow.isDestroyed()) {
          webcamWindow.hide();
        }
      }, 100);
    } else {
      console.log('[Main] No webcam window to hide');
    }
  }
});

ipcMain.on('set-blur', (event, enabled) => {
  console.log('[Main] Received set-blur with enabled:', enabled);
  
  if (webcamWindow) {
    console.log('[Main] Forwarding set-blur to webcam window:', enabled);
    webcamWindow.webContents.send('set-blur', enabled);
  } else {
    console.warn('[Main] Cannot set blur: webcamWindow is not defined');
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

  // Add global error handler for IPC errors
  ipcMain.on('error', (event, message) => {
    console.error('[IPC Error]', message);
  });

  // Handle forced application restart
  ipcMain.on('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    console.log('[Main] All windows closed, preparing to quit...');
    // Add a short delay before quitting to allow webcam cleanup
    setTimeout(() => {
      // Force destroy any remaining webcam window
      if (webcamWindow && !webcamWindow.isDestroyed()) {
        try {
          console.log('[Main] Force cleaning webcam window before quit');
          webcamWindow.webContents.send('stop-webcam');
          webcamWindow.destroy();
          webcamWindow = null;
        } catch (err) {
          console.error('[Main] Error during final webcam cleanup:', err);
        }
      }
      app.quit();
    }, 300);
  }
});

// Handle app quit
app.on('before-quit', () => {
  console.log('[Main] App quitting, cleaning up all resources...');
  
  // Clean up tray icon if it exists
  if (tray) {
    console.log('[Main] Removing tray icon');
    tray.destroy();
    tray = null;
  }
  
  // Make sure webcam window is properly stopped and destroyed
  if (webcamWindow && !webcamWindow.isDestroyed()) {
    try {
      console.log('[Main] Stopping webcam streams and destroying window');
      webcamWindow.webContents.send('stop-webcam');
      webcamWindow.removeAllListeners('close');
      // Use a synchronous approach for cleanup during app quit
      webcamWindow.destroy();
    } catch (err) {
      console.error('[Main] Error destroying webcam window:', err);
    }
    webcamWindow = null;
  }
  
  // Destroy main window if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      console.log('[Main] Destroying main window');
      mainWindow.destroy();
    } catch (err) {
      console.error('[Main] Error destroying main window:', err);
    }
    mainWindow = null;
  }
});