// Main preload script for Cappy Screen & Webcam Recorder
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Keep existing methods
  setTitle: (title) => ipcRenderer.send('set-title', title),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  forceKill: () => ipcRenderer.send('force-kill'),
  notifyRecordingStarted: () => ipcRenderer.send('start-recording'),
  notifyRecordingStopped: () => ipcRenderer.send('stop-recording'),
  resetWebcamPosition: () => ipcRenderer.send('reset-webcam-position'),
  toggleWebcam: (enabled) => ipcRenderer.send('toggle-webcam', enabled),
  
  // Add these missing functions for blur control
  sendSetBlur: (enabled) => {
    console.log('[Preload] Sending set-blur with value:', enabled);
    ipcRenderer.send('set-blur', enabled);
  },
  sendSetBlurStrength: (strength) => {
    console.log('[Preload] Sending set-blur-strength with value:', strength);
    ipcRenderer.send('set-blur-strength', strength);
  },
  sendSetBgColor: (color) => {
    console.log('[Preload] Sending set-bgcolor with color:', color);
    ipcRenderer.send('set-bgcolor', color);
  },

  // Improve these event handlers with better logging
  onSetBlur: (callback) => {
    console.log('[Preload] Registering onSetBlur handler');
    ipcRenderer.on('set-blur', (_, value) => {
      console.log('[Preload] Received set-blur with value:', value);
      callback(value);
    });
  },
  onSetBlurStrength: (callback) => {
    console.log('[Preload] Registering onSetBlurStrength handler');
    ipcRenderer.on('set-blur-strength', (_, value) => {
      console.log('[Preload] Received set-blur-strength with value:', value);
      callback(value);
    });
  },
  onSetBgColor: (callback) => {
    console.log('[Preload] Registering onSetBgColor handler');
    ipcRenderer.on('set-bgcolor', (_, color) => {
      console.log('[Preload] Received set-bgcolor with color:', color);
      callback(color);
    });
  },
  // Add handler for stopping webcam stream
  onStopWebcam: (callback) => {
    console.log('[Preload] Registering onStopWebcam handler');
    ipcRenderer.on('stop-webcam', (event) => {
      console.log('[Preload] Received stop-webcam message');
      callback();
    });
  },
  sendMessage: (channel, ...args) => ipcRenderer.send(channel, ...args)
});

// Expose window management API
contextBridge.exposeInMainWorld('electronWindow', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  hide: () => ipcRenderer.send('main-window-hide'),
  show: () => ipcRenderer.send('main-window-show'),
  startRecording: () => ipcRenderer.send('start-recording'),
  stopRecording: () => ipcRenderer.send('stop-recording')
});

// Desktop capturer API
contextBridge.exposeInMainWorld('electronDesktopCapturer', {
  getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
});

// Webcam background controls
contextBridge.exposeInMainWorld('webcamBackground', {
  setBlur: (enabled) => ipcRenderer.send('set-blur', enabled),
  setBlurStrength: (strength) => ipcRenderer.send('set-blur-strength', strength),
  setBackgroundColor: (color) => ipcRenderer.send('set-bgcolor', color)
});

// Webcam dragging
contextBridge.exposeInMainWorld('webcamDrag', {
  startDrag: () => ipcRenderer.send('webcam-drag-start'),
  endDrag: () => ipcRenderer.send('webcam-drag-end')
});



console.log('[Preload] Script executed successfully');