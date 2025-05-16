// System audio helper functions
class SystemAudioHelper {
    // Try to get system audio with different methods
    static async getSystemAudioStream() {
        try {
            console.log('[SystemAudio] Attempting to get system audio stream');
            console.log('[SystemAudio] navigator.mediaDevices available:', !!navigator.mediaDevices);
            
            if (!navigator.mediaDevices) {
                console.error('[SystemAudio] mediaDevices API not available');
                return null;
            }
            
            console.log('[SystemAudio] getUserMedia available:', typeof navigator.mediaDevices.getUserMedia === 'function');
            console.log('[SystemAudio] getDisplayMedia available:', typeof navigator.mediaDevices.getDisplayMedia === 'function');
            
            // Method 1: Try using system audio source with simpler constraints
            try {
                console.log('[SystemAudio] Trying Method 1: system audio source via getUserMedia');
                // Use a simpler constraint object to avoid potential parsing issues
                const constraints = {
                    audio: { 
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    },
                    video: false
                };
                
                // Check if we're in Electron and should use the system audio source
                if (window.electronAPI) {
                    constraints.audio.mandatory = { chromeMediaSource: 'system' };
                }
                
                console.log('[SystemAudio] Method 1 constraints:', JSON.stringify(constraints, null, 2));
                
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                const audioTracks = stream.getAudioTracks();
                console.log('[SystemAudio] Method 1 audio tracks obtained:', audioTracks.length);
                if (audioTracks.length > 0) {
                    console.log('[SystemAudio] Method 1 track settings:', JSON.stringify(audioTracks[0].getSettings(), null, 2));
                    console.log('[SystemAudio] Method 1 successful');
                    return stream;
                } else {
                    console.warn('[SystemAudio] Method 1 returned stream but with no audio tracks');
                }
            } catch (err) {
                console.error('[SystemAudio] Method 1 failed:', err.message);
                console.error('[SystemAudio] Method 1 error name:', err.name);
            }
              // Method 2: Try using getDisplayMedia with audio
            try {
                console.log('[SystemAudio] Trying Method 2: getDisplayMedia with audio flag');
                const constraints = {
                    video: true,
                    audio: true
                };
                console.log('[SystemAudio] Method 2 constraints:', JSON.stringify(constraints));
                
                const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
                console.log('[SystemAudio] Method 2 getDisplayMedia returned stream successfully');
                
                // Extract just the audio tracks
                const audioTracks = stream.getAudioTracks();
                console.log('[SystemAudio] Method 2 audio tracks obtained:', audioTracks.length);
                
                if (audioTracks.length > 0) {
                    console.log('[SystemAudio] Method 2 track settings:', JSON.stringify(audioTracks[0].getSettings()));
                    console.log('[SystemAudio] Method 2 successful');
                    
                    // Stop video tracks since we only need audio
                    const videoTracks = stream.getVideoTracks();
                    console.log('[SystemAudio] Method 2 stopping', videoTracks.length, 'video tracks');
                    videoTracks.forEach(track => track.stop());
                    
                    // Create a new stream with just the audio tracks
                    const audioStream = new MediaStream(audioTracks);
                    return audioStream;
                } else {
                    console.warn('[SystemAudio] Method 2 returned stream but with no audio tracks');
                }
                
                // Clean up if no audio tracks
                console.log('[SystemAudio] Method 2 cleaning up stream with no audio tracks');
                stream.getTracks().forEach(track => track.stop());
            } catch (err) {
                console.error('[SystemAudio] Method 2 failed:', err.message);
                console.error('[SystemAudio] Method 2 error name:', err.name);
                console.error('[SystemAudio] Method 2 error stack:', err.stack);
            }
            
            // Method 3: Try specific loopback method
            try {
                // This might work in some versions of Chrome/Electron
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        googAudioMirroring: true
                    },
                    video: false
                });
                
                if (stream && stream.getAudioTracks().length > 0) {
                    console.log('[SystemAudio] Method 3 successful');
                    return stream;
                }
            } catch (err) {
                console.log('[SystemAudio] Method 3 failed:', err.message);
            }
            
            console.error('[SystemAudio] All methods failed to get system audio');
            return null;
        } catch (err) {
            console.error('[SystemAudio] Error getting system audio:', err);
            return null;
        }
    }
    
    // Test if system audio capture is supported in this environment
    static async testSystemAudioSupport() {
        try {
            console.log('[SystemAudio] Testing system audio support...');
            
            if (!navigator.mediaDevices) {
                console.error('[SystemAudio] Cannot test system audio - mediaDevices API not available');
                return false;
            }
            
            // Test Method 1: Simple audio capture with lower requirements
            try {
                console.log('[SystemAudio] Testing Method 1 support (simple audio)...');
                // Use simpler constraints first to test basic audio capabilities
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { 
                        echoCancellation: false,
                        noiseSuppression: false
                    },
                    video: false
                });
                
                const tracks = stream.getAudioTracks();
                console.log('[SystemAudio] Method 1 test successful, got', tracks.length, 'audio tracks');
                
                // Clean up
                tracks.forEach(track => track.stop());
                
                // Just verify we can capture audio at all
                if (tracks.length > 0) {
                    return true;
                }
            } catch (err) {
                console.error('[SystemAudio] Method 1 test failed:', err.name, err.message);
            }
            
            // Test Method 2: getDisplayMedia with audio - simplified approach
            try {
                console.log('[SystemAudio] Testing Method 2 support (display media)...');
                
                // Only proceed with getDisplayMedia if it's actually available
                if (typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
                    console.error('[SystemAudio] getDisplayMedia not available, skipping test');
                    return false;
                }
                
                const stream = await navigator.mediaDevices.getDisplayMedia({ 
                    audio: true,
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 360 }
                    }
                });
                
                const audioTracks = stream.getAudioTracks();
                console.log('[SystemAudio] Method 2 test got', audioTracks.length, 'audio tracks');
                
                // Clean up
                stream.getTracks().forEach(track => track.stop());
                
                return audioTracks.length > 0;
            } catch (err) {
                console.error('[SystemAudio] Method 2 test failed:', err.name, err.message);
            }
            
            console.error('[SystemAudio] No system audio capture methods are supported');
            return false;
        } catch (err) {
            console.error('[SystemAudio] Critical error testing system audio support:', err);
            return false;
        }
    }
}

// Make available globally
window.SystemAudioHelper = SystemAudioHelper;
