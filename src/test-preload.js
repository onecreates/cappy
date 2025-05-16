const { contextBridge, ipcRenderer } = require('electron');

console.log('[TestPreload] TEST PRELOAD SCRIPT LOADED');

// Only test a single API to confirm it works
contextBridge.exposeInMainWorld('testAPI', {
  hello: 'world'
});

// Try to expose this just to be sure
contextBridge.exposeInMainWorld('electronAPI', {
  test: true
});

contextBridge.exposeInMainWorld('electronWindow', {
  test: true
});
