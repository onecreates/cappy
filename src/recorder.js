// Screen recording management
class ScreenRecorder {
    constructor() {
        this.screenStream = null;
        this.audioStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.selectedSource = null;
        this.combinedStream = null;
        this.progressInterval = null;
        this.onProgressUpdate = null;
    }
    
    async selectAndStartRecording(audioDeviceId, onProgress, captureSystemAudio = false) {
        console.log("[Recorder] Starting selectAndStartRecording with audioDeviceId:", audioDeviceId);
        console.log("[Recorder] electronDesktopCapturer available:", !!window.electronDesktopCapturer);
        console.log("[Recorder] electronAPI available:", !!window.electronAPI);
        console.log("[Recorder] electronWindow available:", !!window.electronWindow);
        console.log("[Recorder] SystemAudioHelper available:", !!window.SystemAudioHelper);
        console.log("[Recorder] Capture system audio:", captureSystemAudio);
        
        // Check if system audio is actually supported in this environment
        if (captureSystemAudio) {
            try {
                console.log("[Recorder] Checking system audio capabilities before proceeding...");
                let hasSystemAudio = false;
                
                // Try the enhanced handler first if available
                if (window.SystemAudioHandler) {
                    console.log("[Recorder] Using enhanced SystemAudioHandler for testing");
                    hasSystemAudio = await window.SystemAudioHandler.testSystemAudioSupport();
                    console.log("[Recorder] Enhanced system audio support test result:", hasSystemAudio);
                }
                // Fall back to legacy helper if needed
                else if (window.SystemAudioHelper) {
                    console.log("[Recorder] Using legacy SystemAudioHelper for testing");
                    hasSystemAudio = await window.SystemAudioHelper.testSystemAudioSupport();
                    console.log("[Recorder] Legacy system audio support test result:", hasSystemAudio);
                }
                
                // If system audio is not supported, log a warning
                if (!hasSystemAudio) {
                    console.warn("[Recorder] System audio may not be fully supported on this system");
                }
            } catch (err) {
                console.error("[Recorder] Error testing system audio capabilities:", err);
            }
        }
        
        // First try Electron's desktopCapturer if available
        if (window.electronDesktopCapturer) {
            try {
                console.log("[Recorder] Using electronDesktopCapturer to get sources");
                // Use the IPC bridge to get screen sources
                console.log("[Recorder] Calling electronDesktopCapturer.getSources...");
                const sources = await window.electronDesktopCapturer.getSources({
                    types: ["window", "screen"],
                    thumbnailSize: { width: 150, height: 150 }
                });
                
                console.log("[Recorder] Got sources from desktopCapturer:", sources.length);
                console.log("[Recorder] Sources type:", typeof sources, Array.isArray(sources));
                
                if (sources && sources.length > 0) {
                    // Default to first source (usually entire screen)
                    const source = sources[0];
                    console.log("[Recorder] Selected source:", source.id, source.name);
                    
                    // Log basic source properties without any complex object inspection
                    console.log("[Recorder] Source ID:", source.id);
                    console.log("[Recorder] Source name:", source.name);
                    
                    // Get the stream using the source ID
                    console.log("[Recorder] Attempting to get user media stream with sourceId:", source.id);
                    
                    if (!source.id) {
                        console.error("[Recorder] Source ID is missing or invalid, falling back to getDisplayMedia");
                        throw new Error("Invalid source ID");
                    }
                    
                    // Always request video only first for stability
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: false, // Don't include audio in initial request
                        video: {
                            mandatory: {
                                chromeMediaSource: "desktop",
                                chromeMediaSourceId: source.id
                            }
                        }
                    });
                    
                    // If system audio is requested, try to get it separately
                    if (captureSystemAudio) {
                        try {
                            console.log("[Recorder] Attempting to get system audio separately");
                            
                            // First check if system audio was already captured
                            if (stream.getAudioTracks().length > 0) {
                                console.log("[Recorder] System audio already captured in main stream, skipping separate capture");
                                this.screenStream = stream;
                                return this.startRecording(audioDeviceId, onProgress, captureSystemAudio);
                            }
                            
                            // Try the enhanced handler first if available
                            if (window.SystemAudioHandler) {
                                console.log("[Recorder] Using SystemAudioHandler to get system audio");
                                try {
                                    // Use the simpler API to add system audio to our stream
                                    const success = await window.SystemAudioHandler.addSystemAudioToStream(stream);
                                    if (success) {
                                        console.log("[Recorder] SystemAudioHandler successfully added system audio");
                                        console.log("[Recorder] Stream now has audio tracks:", stream.getAudioTracks().length);
                                        
                                        // Don't attempt other methods if enhanced handler succeeded
                                        this.screenStream = stream;
                                        return this.startRecording(audioDeviceId, onProgress, captureSystemAudio);
                                    } else {
                                        console.warn("[Recorder] SystemAudioHandler failed to add system audio, falling back");
                                    }
                                } catch (enhancedErr) {
                                    console.error("[Recorder] Error using SystemAudioHandler:", enhancedErr);
                                    console.error("[Recorder] Falling back to other methods");
                                }
                            }
                            
                            // Try using the legacy helper if available
                            else if (window.SystemAudioHelper) {
                                console.log("[Recorder] Using legacy SystemAudioHelper to get system audio");
                                try {
                                    const systemAudioStream = await window.SystemAudioHelper.getSystemAudioStream();
                                    if (systemAudioStream && systemAudioStream.getAudioTracks().length > 0) {
                                        console.log("[Recorder] SystemAudioHelper successfully got system audio");
                                        const audioTracks = systemAudioStream.getAudioTracks();
                                        audioTracks.forEach(track => {
                                            try {
                                                stream.addTrack(track.clone());
                                            } catch (e) {
                                                console.error("[Recorder] Failed to add cloned audio track:", e);
                                                try {
                                                    stream.addTrack(track);
                                                } catch (e2) {
                                                    console.error("[Recorder] Failed to add original audio track too:", e2);
                                                }
                                            }
                                        });
                                        console.log("[Recorder] Added system audio tracks from helper:", audioTracks.length);
                                        console.log("[Recorder] Stream now has audio tracks:", stream.getAudioTracks().length);
                                        
                                        // Don't attempt legacy method if helper succeeded
                                        this.screenStream = stream;
                                        return this.startRecording(audioDeviceId, onProgress, captureSystemAudio);
                                    } else {
                                        console.warn("[Recorder] SystemAudioHelper failed to get system audio, falling back to legacy method");
                                    }
                                } catch (helperErr) {
                                    console.error("[Recorder] Error using SystemAudioHelper:", helperErr);
                                    console.error("[Recorder] Falling back to legacy method");
                                }
                            } else {
                                console.log("[Recorder] No audio helpers available, using legacy method");
                            }
                            
                            // If helper failed or not available, try legacy approach
                            if (stream.getAudioTracks().length === 0) {
                                console.log("[Recorder] Using legacy method for system audio");
                                
                                try {
                                    // For system audio, we need different constraints
                                    const audioConstraints = { 
                                        audio: { 
                                            mandatory: {
                                                chromeMediaSource: "system",
                                                chromeMediaSourceId: source.id
                                            }
                                        }, 
                                        video: false 
                                    };
                                    const audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                                    // Add audio tracks to the main stream
                                    const audioTracks = audioStream.getAudioTracks();
                                    audioTracks.forEach(track => stream.addTrack(track));
                                    console.log("[Recorder] Added system audio tracks:", audioTracks.length);
                                } catch (audioErr) {
                                    // If system audio fails, continue with video only
                                    console.warn("[Recorder] Could not get system audio, continuing with video only:", audioErr);
                                }
                            }
                            if (stream.getAudioTracks().length > 0) {
                                console.log("[Recorder] Stream obtained successfully");
                                this.screenStream = stream;
                                return this.startRecording(audioDeviceId, onProgress, captureSystemAudio);
                            }
                        } catch (err) {
                            console.error("[Recorder] Error using electronDesktopCapturer:", err);
                            // Fall through to fallbacks
                        }
                    } else {
                        // If system audio not requested, just proceed with video only
                        this.screenStream = stream;
                        return this.startRecording(audioDeviceId, onProgress, false);
                    }
                }
            } catch (err) {
                console.error("[Recorder] Error in electronDesktopCapturer flow:", err);
            }
        }
        
        // Fallback: use native getDisplayMedia if electronDesktopCapturer failed
        console.warn("[Recorder] Falling back to getDisplayMedia");
        this.cleanup();
        
        try {
            console.log("[Recorder] Requesting display media with system audio:", captureSystemAudio);
            // Try to request system audio directly with specific constraints
            const constraints = { 
                video: true,
                audio: captureSystemAudio ? {
                    mandatory: {
                        chromeMediaSource: "system"
                    }
                } : false
            };
            console.log("[Recorder] Display media constraints:", JSON.stringify(constraints));
            
            const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            
            // If system audio is requested, try to get it in a separate step
            if (captureSystemAudio) {
                try {
                    console.log("[Recorder] Attempting to get system audio in separate step");
                    const audioConstraints = {
                        audio: {
                            mandatory: {
                                chromeMediaSource: "system"
                            }
                        },
                        video: false
                    };
                    const audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                    
                    // If successful, add audio tracks to the main stream
                    const audioTracks = audioStream.getAudioTracks();
                    audioTracks.forEach(track => stream.addTrack(track));
                    console.log("[Recorder] Added system audio tracks:", audioTracks.length);
                } catch (audioErr) {
                    // If system audio fails, log but continue with video only
                    console.warn("[Recorder] Could not get system audio, continuing with video only:", audioErr);
                }
            }
            
            this.screenStream = stream;
            
            // Check if we actually got audio tracks when requested
            if (captureSystemAudio) {
                const audioTracks = stream.getAudioTracks();
                console.log("[Recorder] System audio tracks obtained:", audioTracks.length);
                if (audioTracks.length === 0) {
                    console.warn("[Recorder] System audio was requested but no audio tracks were obtained");
                }
            }
            
            // Directly start recording without source selection UI
            return this.startRecording(audioDeviceId, onProgress, captureSystemAudio);
        } catch (err) {
            console.error("[Recorder] getDisplayMedia fallback error:", err);
            
            // Try alternate userMedia chromeMediaSource fallback
            try {
                console.warn("[Recorder] Trying getUserMedia chromeMediaSource fallback");
                
                // Build constraints with safer system audio handling - always separate video and audio
                const constraints = {
                    video: {
                        mandatory: {
                            chromeMediaSource: "desktop",
                            chromeMediaSourceId: "screen:0:0"
                        }
                    },
                    audio: false // Always request video only first
                };
                
                console.log("[Recorder] getUserMedia fallback constraints:", JSON.stringify(constraints));
                const altStream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log("[Recorder] chromeMediaSource getUserMedia fallback succeeded");
                this.screenStream = altStream;
                
                // If system audio was requested, try to add it separately
                if (captureSystemAudio) {
                    try {
                        console.log("[Recorder] Attempting to get system audio in fallback");
                        const audioConstraints = {
                            audio: {
                                mandatory: {
                                    chromeMediaSource: "system"
                                }
                            },
                            video: false
                        };
                        const audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                        const audioTracks = audioStream.getAudioTracks();
                        
                        // Add audio tracks to the main stream
                        audioTracks.forEach(track => altStream.addTrack(track));
                        console.log("[Recorder] Added system audio tracks in fallback:", audioTracks.length);
                    } catch (audioErr) {
                        // If this fails, log and continue without system audio
                        console.warn("[Recorder] Could not get system audio in fallback, continuing with video only:", audioErr);
                    }
                }
                
                return this.startRecording(audioDeviceId, onProgress, false); // Force captureSystemAudio to false in fallback
            } catch (altErr) {
                console.error("[Recorder] chromeMediaSource fallback error:", altErr);
                this.cleanup();
                // Propagate error to be shown by the caller
                throw new Error("Screen capture is not supported: " + altErr.message);
            }
        }
        
        // Clear any existing streams
        this.cleanup();
        console.log("[Recorder] Cleaned up existing streams");

        // Get available sources
        let sourcesArray;
        try {
            console.log("[Recorder] Getting desktop sources...");
            sourcesArray = await window.electronDesktopCapturer.getSources({ 
                types: ["screen", "window"],
                thumbnailSize: { width: 320, height: 180 },
                fetchWindowIcons: true
            });
            console.log("[Recorder] Got sources:", sourcesArray.length);
        } catch (err) {
            console.error("[Recorder] Error getting sources:", err);
            // If capturer fails, force kill as fallback
            if (window.electronAPI && typeof window.electronAPI.forceKill === "function") {
                window.electronAPI.forceKill();
            }
            throw new Error("Failed to get screen sources: " + err.message);
        }

        // Create source selection UI
        return new Promise((resolve, reject) => {
            const overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.top = "0";
            overlay.style.left = "0";
            overlay.style.width = "100vw";
            overlay.style.height = "100vh";
            overlay.style.background = "rgba(0,0,0,0.75)";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            overlay.style.zIndex = "9999";
            overlay.style.opacity = "0";
            overlay.style.transition = "opacity 0.3s ease";

            requestAnimationFrame(() => overlay.style.opacity = "1");

            const modal = document.createElement("div");
            modal.style.background = "#232323";
            modal.style.borderRadius = "16px";
            modal.style.padding = "32px";
            modal.style.maxWidth = "90vw";
            modal.style.maxHeight = "80vh";
            modal.style.overflow = "auto";
            modal.style.position = "relative";
            modal.style.transform = "translateY(20px)";
            modal.style.transition = "transform 0.3s ease";
            modal.style.boxShadow = "0 8px 32px rgba(0,0,0,0.3)";

            requestAnimationFrame(() => modal.style.transform = "translateY(0)");

            // Close button
            const closeBtn = document.createElement("button");
            closeBtn.innerHTML = "✕";
            closeBtn.style.position = "absolute";
            closeBtn.style.top = "16px";
            closeBtn.style.right = "16px";
            closeBtn.style.background = "transparent";
            closeBtn.style.border = "none";
            closeBtn.style.color = "#fff";
            closeBtn.style.fontSize = "24px";
            closeBtn.style.cursor = "pointer";
            closeBtn.onclick = () => {
                overlay.style.opacity = "0";
                modal.style.transform = "translateY(20px)";
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    reject(new Error("Selection cancelled"));
                }, 300);
            };
            
            const title = document.createElement("h2");
            title.innerText = "Select Window to Record";
            title.style.color = "#fff";
            title.style.marginBottom = "16px";
            title.style.textAlign = "center";
            
            const subtitle = document.createElement("p");
            subtitle.innerText = "Choose a specific window or record all windows";
            subtitle.style.color = "rgba(255,255,255,0.7)";
            subtitle.style.fontSize = "14px";
            subtitle.style.marginBottom = "16px";
            subtitle.style.textAlign = "center";

            // Removed keep files UI per updated requirements

            const grid = document.createElement("div");
            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
            grid.style.gap = "16px";
            grid.style.margin = "16px 0";
            
            // Keep all windows button
            const keepAllBtn = document.createElement("button");
            keepAllBtn.textContent = "Record All Windows";
            keepAllBtn.style.background = "#1de9b6";
            keepAllBtn.style.color = "#232323";
            keepAllBtn.style.border = "none";
            keepAllBtn.style.padding = "12px 24px";
            keepAllBtn.style.borderRadius = "8px";
            keepAllBtn.style.cursor = "pointer";
            keepAllBtn.style.fontWeight = "bold";
            keepAllBtn.style.marginBottom = "16px";
            keepAllBtn.style.width = "100%";
            keepAllBtn.onclick = () => startRecording(sourcesArray.find(s => s.id === "screen:0:0"));
            
            const startRecording = async (source) => {
                // Show loading state
                const loadingOverlay = document.createElement("div");
                loadingOverlay.style.position = "absolute";
                loadingOverlay.style.inset = "0";
                loadingOverlay.style.background = "rgba(0,0,0,0.8)";
                loadingOverlay.style.display = "flex";
                loadingOverlay.style.alignItems = "center";
                loadingOverlay.style.justifyContent = "center";
                loadingOverlay.style.borderRadius = "16px";
                
                const loadingText = document.createElement("div");
                loadingText.innerText = "Starting recording...";
                loadingText.style.color = "#fff";
                loadingText.style.fontSize = "18px";
                
                loadingOverlay.appendChild(loadingText);
                modal.appendChild(loadingOverlay);

                try {
                    console.log("[Recorder] Setting up constraints for source:", source.id);
                    const constraints = {
                        audio: false,
                        video: {
                            mandatory: {
                                chromeMediaSource: "desktop",
                                chromeMediaSourceId: source.id
                            }
                        }
                    };

                    console.log("[Recorder] Attempting to get screen stream with constraints:", JSON.stringify(constraints));
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    console.log("[Recorder] Screen stream obtained successfully");
                    this.screenStream = stream;
                    this.selectedSource = source;

                    // Start recording
                    await this.startRecording(audioDeviceId, onProgress);

                    // Fade out and remove overlay
                    overlay.style.opacity = "0";
                    modal.style.transform = "translateY(20px)";
                    setTimeout(() => {
                        document.body.removeChild(overlay);
                        resolve();
                    }, 300);
                } catch (err) {
                    loadingOverlay.remove();
                    throw err;
                }
            };

            sourcesArray.forEach(source => {
                const card = document.createElement("div");
                card.style.background = "#333";
                card.style.padding = "16px";
                card.style.borderRadius = "8px";
                card.style.cursor = "pointer";
                card.style.transition = "all 0.2s ease";
                card.style.transform = "translateY(0)";
                card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                
                card.onmouseenter = () => {
                    card.style.transform = "translateY(-4px)";
                    card.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
                };
                
                card.onmouseleave = () => {
                    card.style.transform = "translateY(0)";
                    card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                };
                
                card.onclick = () => startRecording(source);
                
                const thumb = document.createElement("img");
                thumb.src = source.thumbnail.toDataURL();
                thumb.style.width = "100%";
                thumb.style.borderRadius = "4px";
                thumb.style.marginBottom = "8px";

                const name = document.createElement("div");
                name.innerText = source.name;
                name.style.color = "#fff";
                name.style.fontSize = "14px";
                name.style.textAlign = "center";
                name.style.overflow = "hidden";
                name.style.textOverflow = "ellipsis";
                name.style.whiteSpace = "nowrap";

                card.appendChild(thumb);
                card.appendChild(name);
                grid.appendChild(card);
            });

            modal.appendChild(closeBtn);
            modal.appendChild(title);
            modal.appendChild(subtitle);
            modal.appendChild(keepAllBtn);
            modal.appendChild(grid);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        });
    }
    
    async startRecording(audioDeviceId, onProgress, captureSystemAudio = false) {
        console.log("[Recorder] Starting recording with audioDeviceId:", audioDeviceId);
        console.log("[Recorder] System audio capture:", captureSystemAudio);
        if (!this.screenStream) {
            console.error("[Recorder] No screen stream available");
            throw new Error("No screen selected. Please select a screen first.");
        }
        
        // Get audio if device ID is provided
        if (audioDeviceId) {
            try {
                console.log("[Recorder] Attempting to access audio device:", audioDeviceId);
                this.audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: { 
                        deviceId: { exact: audioDeviceId },
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });
                console.log("[Recorder] Audio stream obtained successfully");
            } catch (err) {
                console.error("[Recorder] Error accessing audio:", err);
                throw new Error(`Could not access microphone: ${err.message}`);
            }
        }
        
        // Combine streams
        console.log("[Recorder] Combining streams");
        const videoTracks = this.screenStream.getVideoTracks();
        console.log("[Recorder] Screen video tracks:", videoTracks.length);
        
        // Start with only video tracks
        const tracks = [...videoTracks];
        
        // Check for system audio tracks from screen capture
        const systemAudioTracks = this.screenStream.getAudioTracks();
        if (systemAudioTracks.length > 0) {
            console.log("[Recorder] System audio tracks found:", systemAudioTracks.length);
            if (captureSystemAudio) {
                console.log("[Recorder] Adding system audio tracks to recording");
                tracks.push(...systemAudioTracks);
            } else {
                console.log("[Recorder] System audio available but not requested, skipping");
            }
        } else if (captureSystemAudio) {
            console.warn("[Recorder] System audio was requested but no tracks found - attempting to get system audio again");
            
            // Try using enhanced handler first if available
            if (window.SystemAudioHandler) {
                try {
                    console.log("[Recorder] Using SystemAudioHandler for last-minute system audio");
                    const audioStream = await window.SystemAudioHandler.getSystemAudioStream();
                    if (audioStream) {
                        const audioTracks = audioStream.getAudioTracks();
                        if (audioTracks.length > 0) {
                            console.log("[Recorder] Got system audio tracks using enhanced handler:", audioTracks.length);
                            tracks.push(...audioTracks);
                        }
                    }
                } catch (err) {
                    console.warn("[Recorder] Enhanced handler failed for system audio:", err);
                }
            } else {
                // Try simple approach as fallback
                try {
                    console.log("[Recorder] Attempting simple fallback for system audio");
                    const audioStream = await navigator.mediaDevices.getUserMedia({
                        audio: { 
                            echoCancellation: false,
                            noiseSuppression: false
                        },
                        video: false
                    });
                    const audioTracks = audioStream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        console.log("[Recorder] Got audio tracks on fallback attempt:", audioTracks.length);
                        tracks.push(...audioTracks);
                    }
                } catch (err) {
                    console.warn("[Recorder] Failed to get audio on fallback attempt:", err);
                }
            }
        }
        
        // Add microphone audio if available
        if (this.audioStream) {
            const micAudioTracks = this.audioStream.getAudioTracks();
            console.log("[Recorder] Microphone audio tracks:", micAudioTracks.length);
            tracks.push(...micAudioTracks);
        }

        try {
            console.log("[Recorder] Creating MediaStream with tracks:", tracks.length);
            this.combinedStream = new MediaStream(tracks);
            console.log("[Recorder] Creating MediaRecorder");
            this.mediaRecorder = new MediaRecorder(this.combinedStream);
            this.recordedChunks = [];
            console.log("[Recorder] MediaRecorder created successfully");
        
            // Set up recording progress tracking
            let startTime = Date.now();
            if (onProgress) {
                this.progressInterval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    onProgress(elapsed);
                }, 500);
            }
            
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.recordedChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.isRecording = false;
                if (this.progressInterval) {
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                }
                const blob = new Blob(this.recordedChunks, { type: "video/webm" });
                this.saveRecording(blob);
                this.cleanup();
            };

            // Correctly placed start and flag setting
            this.mediaRecorder.start();
            this.isRecording = true;

        } catch (err) {
            console.error("[Recorder] Error in startRecording operation:", err);
            if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
            this.cleanup(); // Ensure resources are cleaned up on error
            throw err; // Re-throw the error for the UI to handle
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }
    }
    
    cleanup() {
        try {
            console.log("[Recorder] Starting cleanup");
            // Clear progress tracking
            if (this.progressInterval) {
                console.log("[Recorder] Clearing progress interval");
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
            
            // Properly stop all media tracks
            const stopTracks = (stream) => {
                if (stream) {
                    const tracks = stream.getTracks();
                    console.log(`[Recorder] Stopping ${tracks.length} tracks for stream`);
                    tracks.forEach(track => {
                        try {
                            // Make sure the track is still active before stopping
                            if (track.readyState === "live") {
                                track.stop();
                                console.log("[Recorder] Stopped track:", track.kind, track.label);
                            } else {
                                console.log("[Recorder] Track already stopped:", track.kind, track.label);
                            }
                        } catch (err) {
                            console.error(`[Recorder] Error stopping track:`, err);
                        }
                    });
                }
            };

            // Stop all streams and ensure we release all resources
            stopTracks(this.screenStream);
            stopTracks(this.audioStream);
            stopTracks(this.combinedStream);
            
            // Additional safeguard: explicitly collect and release all tracks from all sources
            const trackSet = new Set();
            
            // Collect all tracks
            [this.screenStream, this.audioStream, this.combinedStream].forEach(stream => {
                if (stream) {
                    stream.getTracks().forEach(track => trackSet.add(track));
                }
            });
            
            // Stop any potentially missed tracks
            console.log(`[Recorder] Stopping ${trackSet.size} total unique tracks`);
            trackSet.forEach(track => {
                try {
                    if (track.readyState === "live") {
                        track.stop();
                    }
                } catch (e) {
                    console.error("[Recorder] Error stopping track in final cleanup:", e);
                }
            });
            
            // Clear references
            this.screenStream = null;
            this.audioStream = null;
            this.combinedStream = null;
            this.recordedChunks = [];
            this.selectedSource = null;
            this.isRecording = false;
            
            // Force garbage collection hint (indirectly)
            setTimeout(() => {
                console.log("[Recorder] Delayed cleanup complete");
            }, 100);
            
            console.log("[Recorder] Primary cleanup completed");
        } catch (err) {
            console.error("[Recorder] Error during cleanup:", err);
            // Even if cleanup fails, make sure we reset our state
            this.screenStream = null;
            this.audioStream = null;
            this.combinedStream = null;
            this.recordedChunks = [];
            this.selectedSource = null;
            this.isRecording = false;
        }
    }

    saveRecording(blob) {
        console.log("[Recorder] Saving recording, blob size:", blob.size);
        try {
            // Always download the file
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = `recording-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.webm`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                this.showNotification("Recording saved!");
                console.log("[Recorder] Recording saved successfully");
            }, 100);
        } catch (err) {
            console.error("[Recorder] Error saving recording:", err);
            this.showNotification("Error saving recording!");
        }
    }

    showNotification(message) {
        const notif = document.createElement("div");
        notif.textContent = message;
        notif.style.position = "fixed";
        notif.style.bottom = "32px";
        notif.style.left = "50%";
        notif.style.transform = "translateX(-50%)";
        notif.style.background = "#1de9b6";
        notif.style.color = "#232323";
        notif.style.fontWeight = "bold";
        notif.style.padding = "0.7em 2em";
        notif.style.borderRadius = "1.5em";
        notif.style.boxShadow = "0 2px 16px rgba(0,0,0,0.18)";
        notif.style.zIndex = 99999;
        notif.style.fontSize = "1.1em";
        notif.style.animation = "fadeInUp 0.3s ease-out";
        
        const style = document.createElement("style");
        style.textContent = `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = "fadeOutDown 0.3s ease-in forwards";
            setTimeout(() => {
                document.body.removeChild(notif);
                document.head.removeChild(style);
            }, 300);
        }, 3000);
    }
}

// Make ScreenRecorder available globally
window.ScreenRecorder = ScreenRecorder;
