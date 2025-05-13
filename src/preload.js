const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronDesktopCapturer', {
  getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
});

contextBridge.exposeInMainWorld('electronAPI', {
  // For mainWindow: Send set-blur event to main process
  sendSetBlur: (enabled) => {
    ipcRenderer.send('set-blur', enabled);
  },
  // For toggling webcam
  toggleWebcam: (enabled) => {
    ipcRenderer.send('toggle-webcam', enabled);
  },
  // For toggling webcam
  toggleWebcam: (enabled) => {
    ipcRenderer.send('toggle-webcam', enabled);
  },
  // For previewWindow: Receive set-blur event from main process
  onSetBlur: (callback) => {
    ipcRenderer.on('set-blur', (event, enabled) => callback(enabled));
  },
  onSetBgColor: (callback) => {
    ipcRenderer.on('set-bgcolor', (event, color) => callback(color));
  },
  setBgColor: (color) => ipcRenderer.send('set-bgcolor', color),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback)
});

// Expose window and recording controls
contextBridge.exposeInMainWorld('electronWindow', {
  hide: () => ipcRenderer.send('main-window-hide'),
  show: () => ipcRenderer.send('main-window-show'),
  startRecording: () => ipcRenderer.send('start-recording'),
  stopRecording: () => ipcRenderer.send('stop-recording'),
  toggleWebcam: (enabled) => ipcRenderer.send('toggle-webcam', enabled)
});