const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Initializing preload script');

// Enable logging from renderer to main process
const sendToMain = (channel, ...args) => {
    ipcRenderer.send('console', channel, ...args);
};

contextBridge.exposeInMainWorld('console', {
    log: (...args) => sendToMain('log', ...args),
    error: (...args) => sendToMain('error', ...args),
    warn: (...args) => sendToMain('warn', ...args),
    info: (...args) => sendToMain('info', ...args)
});

contextBridge.exposeInMainWorld('electronDesktopCapturer', {
  getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
});

contextBridge.exposeInMainWorld('electronAPI', {
  // For mainWindow: Send set-blur event to main process
  sendSetBlur: (enabled) => {
    ipcRenderer.send('set-blur', enabled);
  },
  // For setting blur strength
  setBlurStrength: (strength) => {
    ipcRenderer.send('set-blur-strength', strength);
  },
  // For toggling webcam
  toggleWebcam: (enabled) => {
    ipcRenderer.send('toggle-webcam', enabled);
  },
  // For previewWindow: Receive set-blur event from main process
  onSetBlur: (callback) => {
    ipcRenderer.on('set-blur', (event, enabled) => callback(enabled));
  },
  onSetBlurStrength: (callback) => {
    ipcRenderer.on('set-blur-strength', (event, strength) => callback(strength));
  },
  onSetBgColor: (callback) => {
    ipcRenderer.on('set-bgcolor', (event, color) => callback(color));
  },
  setBgColor: (color) => ipcRenderer.send('set-bgcolor', color),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),
  // Force quit the app when desktop capturer is unavailable
  forceKill: () => ipcRenderer.send('force-kill')
});

// Expose window and recording controls
contextBridge.exposeInMainWorld('electronWindow', {
  hide: () => ipcRenderer.send('main-window-hide'),
  show: () => ipcRenderer.send('main-window-show'),
  startRecording: () => ipcRenderer.send('start-recording'),
  stopRecording: () => ipcRenderer.send('stop-recording'),
  toggleWebcam: (enabled) => ipcRenderer.send('toggle-webcam', enabled)
});

// Add window management APIs
contextBridge.exposeInMainWorld('electron', {
  setIgnoreMouseEvents: (...args) => ipcRenderer.invoke('set-ignore-mouse-events', ...args),
  resetPosition: () => ipcRenderer.invoke('reset-webcam-position'),
});