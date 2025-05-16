// Enhanced System Audio Handler
// This module provides safer methods for system audio capture
// with fallbacks and error handling

class SystemAudioHandler {
    // Get system audio using safer methods
    static async getSystemAudioStream() {
        console.log('[SystemAudioHandler] Starting getSystemAudioStream');
        
        // First check if we're in Electron and try the Electron-specific method first
        if (window.electronAPI) {
            try {
                console.log('[SystemAudioHandler] Detected Electron environment, trying Electron-specific method first');
                // Attempt Electron-specific system audio capture
                const constraints = {
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'system'
                        }
                    },
                    video: false
                };
                
                try {
                    const electronStream = await navigator.mediaDevices.getUserMedia(constraints);
                    const electronAudioTracks = electronStream.getAudioTracks();
                    
                    if (electronAudioTracks.length > 0) {
                        console.log('[SystemAudioHandler] Electron system audio capture succeeded');
                        return electronStream;
                    } else {
                        console.log('[SystemAudioHandler] No audio tracks from Electron system audio');
                        electronStream.getTracks().forEach(track => {
                            try { 
                                track.stop(); 
                            } catch (e) { 
                                console.log('[SystemAudioHandler] Error stopping track:', e); 
                            }
                        });
                    }
                } catch (streamErr) {
                    console.error('[SystemAudioHandler] Error getting system audio stream:', streamErr.message);
                }
            } catch (electronErr) {
                console.error('[SystemAudioHandler] Electron system audio failed:', electronErr.message);
            }
        }
          // Method 1: Safe getDisplayMedia with audio only (as fallback)
        // Skip getDisplayMedia in Electron environment as it tends to cause IPC issues
        if (!window.electronAPI) {
            try {
                console.log('[SystemAudioHandler] Trying getDisplayMedia with audio only');
                if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
                    console.error('[SystemAudioHandler] getDisplayMedia not available');
                    throw new Error('getDisplayMedia not available');
                }
                
                // Request minimal UI with just audio and simple video
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    audio: true,
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });
            
            
            console.log('[SystemAudioHandler] getDisplayMedia succeeded');
            
            // If we got audio tracks, create a new stream with just those
            const audioTracks = stream.getAudioTracks();
            console.log('[SystemAudioHandler] Audio tracks:', audioTracks.length);
            
            if (audioTracks.length > 0) {
                console.log('[SystemAudioHandler] Creating audio-only stream');
                // Stop video tracks to save resources
                stream.getVideoTracks().forEach(track => track.stop());
                
                // Return new stream with just audio tracks
                return new MediaStream(audioTracks);
            } else {
                console.log('[SystemAudioHandler] No audio tracks in display media');
                // Clean up the stream since we don't need it
                stream.getTracks().forEach(track => track.stop());
                throw new Error('No audio tracks found');            }
            } catch (err) {
                console.error('[SystemAudioHandler] getDisplayMedia failed:', err.message);
            }
        } else {
            console.log('[SystemAudioHandler] Skipping getDisplayMedia in Electron environment');
        }
        
        // Method 2: Try getUserMedia with standard audio (non-Electron fallback)
        try {
            console.log('[SystemAudioHandler] Trying getUserMedia with system audio');
            
            const constraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                },
                video: false
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const audioTracks = stream.getAudioTracks();
            
            if (audioTracks.length > 0) {
                console.log('[SystemAudioHandler] getUserMedia system audio succeeded');
                return stream;
            } else {
                console.log('[SystemAudioHandler] No audio tracks from getUserMedia system audio');
                stream.getTracks().forEach(track => track.stop());
                throw new Error('No system audio tracks found');
            }
        } catch (err) {
            console.error('[SystemAudioHandler] getUserMedia system audio failed:', err.message);
        }
        
        console.error('[SystemAudioHandler] All system audio capture methods failed');
        return null;
    }
    
    // Safely add system audio to an existing stream
    static async addSystemAudioToStream(stream) {
        if (!stream) {
            console.error('[SystemAudioHandler] No stream provided to add system audio to');
            return false;
        }
        
        try {
            console.log('[SystemAudioHandler] Getting system audio to add to stream');
            const audioStream = await this.getSystemAudioStream();
            
            if (audioStream) {
                const audioTracks = audioStream.getAudioTracks();
                console.log('[SystemAudioHandler] Adding', audioTracks.length, 'system audio tracks to stream');
                
                // Make sure we have valid tracks before proceeding
                if (audioTracks.length === 0) {
                    console.warn('[SystemAudioHandler] No audio tracks found in system audio stream');
                    return false;
                }
                
                // Add tracks safely
                let addedTracks = 0;
                for (const track of audioTracks) {
                    try {
                        // First check if this track is valid
                        if (track.readyState === 'live') {
                            stream.addTrack(track);
                            addedTracks++;
                        } else {
                            console.warn('[SystemAudioHandler] Skipping non-live track');
                        }
                    } catch (err) {
                        console.error('[SystemAudioHandler] Error adding track:', err.message);
                    }
                }
                
                return addedTracks > 0;
            }
        } catch (err) {
            console.error('[SystemAudioHandler] Error adding system audio to stream:', err);
        }
        
        return false;
    }
      // Test if system audio is supported
    static async testSystemAudioSupport() {
        console.log('[SystemAudioHandler] Testing system audio support');
        
        try {
            // First check if we're in Electron - that's our best chance for system audio
            if (window.electronAPI) {
                console.log('[SystemAudioHandler] Electron environment detected, system audio should be supported');
                
                try {
                    // Try a quick test with Electron-specific constraints
                    const testConstraints = {
                        audio: {
                            mandatory: {
                                chromeMediaSource: 'system'
                            }
                        },
                        video: false
                    };
                    
                    const testStream = await navigator.mediaDevices.getUserMedia(testConstraints);
                    const hasAudioTracks = testStream.getAudioTracks().length > 0;
                    console.log('[SystemAudioHandler] Electron system audio quick test result:', hasAudioTracks);
                    
                    // Always clean up test stream
                    testStream.getTracks().forEach(track => {
                        try {
                            track.stop();
                        } catch (e) {
                            console.warn('[SystemAudioHandler] Error stopping test track:', e);
                        }
                    });
                    
                    if (hasAudioTracks) {
                        return true; // Early success
                    }
                } catch (quickTestErr) {
                    console.warn('[SystemAudioHandler] Electron quick test failed:', quickTestErr.message);
                    // Fall through to full test
                }
            }
            
            // Full test with all fallbacks
            const stream = await this.getSystemAudioStream();
            if (stream) {
                const hasAudioTracks = stream.getAudioTracks().length > 0;
                console.log('[SystemAudioHandler] System audio support test result:', hasAudioTracks);
                
                // Clean up
                stream.getTracks().forEach(track => {
                    try {
                        track.stop();
                    } catch (e) {
                        console.warn('[SystemAudioHandler] Error stopping track during cleanup:', e);
                    }
                });
                
                return hasAudioTracks;
            }
        } catch (err) {
            console.error('[SystemAudioHandler] System audio test failed:', err);
        }
        
        console.log('[SystemAudioHandler] No system audio support detected');
        return false;
    }
}

// Make available globally
window.SystemAudioHandler = SystemAudioHandler;
