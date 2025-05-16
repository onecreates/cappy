// Extra diagnostic preload script
const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

console.log('[DiagPreload] -------------- DIAGNOSTIC PRELOAD SCRIPT STARTED --------------');
console.log('[DiagPreload] This is a diagnostic preload script to debug API exposure issues');
console.log('[DiagPreload] Available Electron APIs:', Object.keys(require('electron')));

// Create a very simple API to test if preload is working at all
contextBridge.exposeInMainWorld('diagAPI', {
  hello: 'world',
  test: true,
  timestamp: new Date().toISOString()
});

// Log success for contextBridge calls
console.log('[DiagPreload] ✓ Exposed diagAPI to renderer');

// Also try to expose the original APIs
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // For mainWindow: Send set-blur event to main process
    sendSetBlur: (enabled) => {
      console.log('[DiagPreload] Calling sendSetBlur:', enabled);
      ipcRenderer.send('set-blur', enabled);
    },
    // For setting blur strength
    setBlurStrength: (strength) => {
      console.log('[DiagPreload] Calling setBlurStrength:', strength);
      ipcRenderer.send('set-blur-strength', strength);
    },
    // For toggling webcam
    toggleWebcam: (enabled) => {
      console.log('[DiagPreload] Calling toggleWebcam:', enabled);
      ipcRenderer.send('toggle-webcam', enabled);
    },
    // General purpose message sender for webcam window
    sendMessage: (channel, data) => {
      console.log('[DiagPreload] Sending message on channel:', channel, data || '');
      ipcRenderer.send(channel, data);
    },
    // For previewWindow: Receive set-blur event from main process
    onSetBlur: (callback) => {
      ipcRenderer.on('set-blur', (event, enabled) => {
        console.log('[DiagPreload] Received set-blur event:', enabled);
        callback(enabled)
      });
    },
    onSetBlurStrength: (callback) => {
      ipcRenderer.on('set-blur-strength', (event, strength) => {
        console.log('[DiagPreload] Received set-blur-strength event:', strength);
        callback(strength)
      });
    },
    onSetBgColor: (callback) => {
      ipcRenderer.on('set-bgcolor', (event, color) => {
        console.log('[DiagPreload] Received set-bgcolor event:', color);
        callback(color)
      });
    },
    setBgColor: (color) => {
      console.log('[DiagPreload] Calling setBgColor:', color);
      ipcRenderer.send('set-bgcolor', color);
    },
    onStopRecording: (callback) => {
      ipcRenderer.on('stop-recording', (event) => {
        console.log('[DiagPreload] Received stop-recording event');
        callback(event)
      });
    },
    forceKill: () => {
      console.log('[DiagPreload] Calling forceKill');
      ipcRenderer.send('force-kill')
    },
    // For resetting webcam position
    resetWebcamPosition: () => {
      console.log('[DiagPreload] Calling resetWebcamPosition');
      ipcRenderer.send('reset-webcam-position');
    },    // Webcam source selection has been removed
  });
  console.log('[DiagPreload] ✓ Exposed electronAPI to renderer');  // Expose desktopCapturer API to renderer process
  contextBridge.exposeInMainWorld('electronDesktopCapturer', {
    getSources: async (opts) => {
      try {
        console.log('[DiagPreload] Invoking DESKTOP_CAPTURER_GET_SOURCES with opts:', opts);
        const sources = await ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts);
        console.log('[DiagPreload] Got sources count:', sources?.length || 0);
          // Log information about the returned sources but avoid complex object inspection
        if (sources && sources.length > 0) {
          const firstSource = sources[0];
          console.log('[DiagPreload] First source id:', firstSource.id || 'missing');
          console.log('[DiagPreload] First source name:', firstSource.name || 'missing');
          
          // Basic validation to ensure we have required properties
          if (!firstSource.id) {
            console.warn('[DiagPreload] First source is missing required id property');
          }
        }
        
        return sources || [];
      } catch (error) {
        console.error('[DiagPreload] Error in getSources:', error);
        return []; // Return empty array to prevent renderer errors
      }
    },
    getSourcesSync: () => {
      console.log('[DiagPreload] Warning: electronDesktopCapturer.getSourcesSync called, which is async-only');
      return ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', {types: ['window', 'screen']})
        .catch(err => {
          console.error('[DiagPreload] Error in getSourcesSync:', err);
          return [];
        });
    }
  });
  console.log('[DiagPreload] ✓ Exposed electronDesktopCapturer to renderer');

  contextBridge.exposeInMainWorld('electronWindow', {
    hide: () => {
      console.log('[DiagPreload] Calling electronWindow.hide');
      ipcRenderer.send('main-window-hide');
    },
    show: () => {
      console.log('[DiagPreload] Calling electronWindow.show');
      ipcRenderer.send('main-window-show');
    },
    startRecording: () => {
      console.log('[DiagPreload] Calling electronWindow.startRecording');
      ipcRenderer.send('start-recording');
    },
    stopRecording: () => {
      console.log('[DiagPreload] Calling electronWindow.stopRecording');
      ipcRenderer.send('stop-recording');
    },
    toggleWebcam: (enabled) => {
      console.log('[DiagPreload] Calling electronWindow.toggleWebcam:', enabled);
      ipcRenderer.send('toggle-webcam', enabled);
    }
  });
  console.log('[DiagPreload] ✓ Exposed electronWindow to renderer');

  console.log('[DiagPreload] -------------- ALL APIs EXPOSED SUCCESSFULLY --------------');
} catch (err) {
  console.error('[DiagPreload] ✗ ERROR exposing APIs:', err);
}
