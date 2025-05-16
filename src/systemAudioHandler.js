// Enhanced System Audio Handler
// This module provides safer methods for system audio capture
// with fallbacks and error handling

class SystemAudioHandler {
    // Get system audio using safer methods
    static async getSystemAudioStream() {
        console.log('[SystemAudioHandler] Starting getSystemAudioStream');
        
        // Method 1: Safe getDisplayMedia with audio only
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
                throw new Error('No audio tracks found');
            }
        } catch (err) {
            console.error('[SystemAudioHandler] getDisplayMedia failed:', err.message);
        }
        
        // Method 2: Try getUserMedia with system audio (Electron-specific)
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
            
            // Only add system audio source if we're in Electron
            if (window.electronAPI) {
                console.log('[SystemAudioHandler] Adding Electron-specific system audio constraints');
                constraints.audio.mandatory = {
                    chromeMediaSource: 'system'
                };
            }
            
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
                
                // Clone tracks to avoid errors
                audioTracks.forEach(track => {
                    try {
                        stream.addTrack(track);
                    } catch (err) {
                        console.error('[SystemAudioHandler] Error adding track:', err.message);
                    }
                });
                
                return audioTracks.length > 0;
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
            const stream = await this.getSystemAudioStream();
            if (stream) {
                const hasAudioTracks = stream.getAudioTracks().length > 0;
                console.log('[SystemAudioHandler] System audio support test result:', hasAudioTracks);
                
                // Clean up
                stream.getTracks().forEach(track => track.stop());
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
