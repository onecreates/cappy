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
    }    async selectAndStartRecording(audioDeviceId, onProgress) {
        console.log('[Recorder] Starting selectAndStartRecording with audioDeviceId:', audioDeviceId);
        if (!window.electronDesktopCapturer) {
            console.error('[Recorder] Desktop capturer not available');
            throw new Error('Desktop capturer not available');
        }

        // Clear any existing streams
        this.cleanup();
        console.log('[Recorder] Cleaned up existing streams');

        let sources;
        try {
            console.log('[Recorder] Getting desktop sources...');
            sources = await window.electronDesktopCapturer.getSources({ 
                types: ['screen', 'window'],
                thumbnailSize: { width: 320, height: 180 },
                fetchWindowIcons: true
            });
            console.log('[Recorder] Got sources:', sources.length);
        } catch (err) {
            console.error('[Recorder] Error getting sources:', err);
            throw new Error('Failed to get screen sources: ' + err.message);
        }

        return new Promise((resolve, reject) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'rgba(0,0,0,0.75)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '9999';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s ease';

            requestAnimationFrame(() => overlay.style.opacity = '1');

            const modal = document.createElement('div');
            modal.style.background = '#232323';
            modal.style.borderRadius = '16px';
            modal.style.padding = '32px';
            modal.style.maxWidth = '90vw';
            modal.style.maxHeight = '80vh';
            modal.style.overflow = 'auto';
            modal.style.position = 'relative';
            modal.style.transform = 'translateY(20px)';
            modal.style.transition = 'transform 0.3s ease';
            modal.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';

            requestAnimationFrame(() => modal.style.transform = 'translateY(0)');

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '16px';
            closeBtn.style.right = '16px';
            closeBtn.style.background = 'transparent';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#fff';
            closeBtn.style.fontSize = '24px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = () => {
                overlay.style.opacity = '0';
                modal.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    reject(new Error('Selection cancelled'));
                }, 300);
            };            const title = document.createElement('h2');
            title.innerText = 'Select Window to Record';
            title.style.color = '#fff';
            title.style.marginBottom = '16px';
            title.style.textAlign = 'center';
              const subtitle = document.createElement('p');
            subtitle.innerText = 'Choose a specific window or record all windows';
            subtitle.style.color = 'rgba(255,255,255,0.7)';
            subtitle.style.fontSize = '14px';
            subtitle.style.marginBottom = '16px';
            subtitle.style.textAlign = 'center';

            // Option for keeping files
            const keepFilesContainer = document.createElement('div');
            keepFilesContainer.style.marginBottom = '24px';
            keepFilesContainer.style.textAlign = 'center';

            const keepFilesLabel = document.createElement('label');
            keepFilesLabel.style.color = '#fff';
            keepFilesLabel.style.display = 'flex';
            keepFilesLabel.style.alignItems = 'center';
            keepFilesLabel.style.justifyContent = 'center';
            keepFilesLabel.style.gap = '8px';
            keepFilesLabel.style.cursor = 'pointer';

            const keepFilesCheckbox = document.createElement('input');
            keepFilesCheckbox.type = 'checkbox';
            keepFilesCheckbox.checked = true;
            keepFilesCheckbox.style.cursor = 'pointer';

            const keepFilesText = document.createTextNode('Keep files after recording');
            keepFilesLabel.appendChild(keepFilesCheckbox);
            keepFilesLabel.appendChild(keepFilesText);
            keepFilesContainer.appendChild(keepFilesLabel);

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
            grid.style.gap = '16px';
            grid.style.margin = '16px 0';
            
            // Keep all windows button
            const keepAllBtn = document.createElement('button');
            keepAllBtn.textContent = 'Record All Windows';
            keepAllBtn.style.background = '#1de9b6';
            keepAllBtn.style.color = '#232323';
            keepAllBtn.style.border = 'none';
            keepAllBtn.style.padding = '12px 24px';
            keepAllBtn.style.borderRadius = '8px';
            keepAllBtn.style.cursor = 'pointer';
            keepAllBtn.style.fontWeight = 'bold';
            keepAllBtn.style.marginBottom = '16px';
            keepAllBtn.style.width = '100%';
            keepAllBtn.onclick = () => startRecording(sources.find(s => s.id === 'screen:0:0'));

            const startRecording = async (source) => {
                // Show loading state
                const loadingOverlay = document.createElement('div');
                loadingOverlay.style.position = 'absolute';
                loadingOverlay.style.inset = '0';
                loadingOverlay.style.background = 'rgba(0,0,0,0.8)';
                loadingOverlay.style.display = 'flex';
                loadingOverlay.style.alignItems = 'center';
                loadingOverlay.style.justifyContent = 'center';
                loadingOverlay.style.borderRadius = '16px';
                
                const loadingText = document.createElement('div');
                loadingText.innerText = 'Starting recording...';
                loadingText.style.color = '#fff';
                loadingText.style.fontSize = '18px';
                
                loadingOverlay.appendChild(loadingText);
                modal.appendChild(loadingOverlay);

        try {
            console.log('[Recorder] Setting up constraints for source:', source.id);
            const constraints = {
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: source.id
                    }
                }
            };

            console.log('[Recorder] Attempting to get screen stream with constraints:', JSON.stringify(constraints));
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('[Recorder] Screen stream obtained successfully');
            this.screenStream = stream;
            this.selectedSource = source;

                    // Start recording
                    await this.startRecording(audioDeviceId, onProgress);

                    // Fade out and remove overlay
                    overlay.style.opacity = '0';
                    modal.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        document.body.removeChild(overlay);
                        resolve();
                    }, 300);
                } catch (err) {
                    loadingOverlay.remove();
                    throw err;
                }
            };

            sources.forEach(source => {
                const card = document.createElement('div');
                card.style.background = '#333';
                card.style.padding = '16px';
                card.style.borderRadius = '8px';
                card.style.cursor = 'pointer';
                card.style.transition = 'all 0.2s ease';
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                
                card.onmouseenter = () => {
                    card.style.transform = 'translateY(-4px)';
                    card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
                };
                
                card.onmouseleave = () => {
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                };
                
                card.onclick = () => startRecording(source);
                
                const thumb = document.createElement('img');
                thumb.src = source.thumbnail.toDataURL();
                thumb.style.width = '100%';
                thumb.style.borderRadius = '4px';
                thumb.style.marginBottom = '8px';

                const name = document.createElement('div');
                name.innerText = source.name;
                name.style.color = '#fff';
                name.style.fontSize = '14px';
                name.style.textAlign = 'center';
                name.style.overflow = 'hidden';
                name.style.textOverflow = 'ellipsis';
                name.style.whiteSpace = 'nowrap';

                card.appendChild(thumb);
                card.appendChild(name);
                grid.appendChild(card);            });

            modal.appendChild(closeBtn);
            modal.appendChild(title);
            modal.appendChild(subtitle);
            modal.appendChild(keepFilesContainer);
            modal.appendChild(keepAllBtn);
            modal.appendChild(grid);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        });
    }    async startRecording(audioDeviceId, onProgress) {
        console.log('[Recorder] Starting recording with audioDeviceId:', audioDeviceId);
        if (!this.screenStream) {
            console.error('[Recorder] No screen stream available');
            throw new Error('No screen selected. Please select a screen first.');
        }
        
        // Get audio if device ID is provided
        if (audioDeviceId) {
            try {
                console.log('[Recorder] Attempting to access audio device:', audioDeviceId);
                this.audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: { 
                        deviceId: { exact: audioDeviceId },
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });
                console.log('[Recorder] Audio stream obtained successfully');
            } catch (err) {
                console.error('[Recorder] Error accessing audio:', err);
                throw new Error(`Could not access microphone: ${err.message}`);
            }
        }        // Combine streams
        console.log('[Recorder] Combining streams');
        const tracks = [...this.screenStream.getTracks()];
        console.log('[Recorder] Screen tracks:', tracks.length);
        
        if (this.audioStream) {
            const audioTracks = this.audioStream.getAudioTracks();
            console.log('[Recorder] Audio tracks:', audioTracks.length);
            tracks.push(...audioTracks);
        }

        try {
            console.log('[Recorder] Creating MediaStream with tracks:', tracks.length);
            this.combinedStream = new MediaStream(tracks);
            console.log('[Recorder] Creating MediaRecorder');
            this.mediaRecorder = new MediaRecorder(this.combinedStream);
            this.recordedChunks = [];
            console.log('[Recorder] MediaRecorder created successfully');
        
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
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            this.saveRecording(blob);
            this.cleanup();
        };

        this.mediaRecorder.start();
        this.isRecording = true;
    }    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }
    }    cleanup() {
        try {
            console.log('[Recorder] Starting cleanup');
            // Clear progress tracking
            if (this.progressInterval) {
                console.log('[Recorder] Clearing progress interval');
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
                            track.stop();
                            console.log('[Recorder] Stopped track:', track.kind);
                        } catch (err) {
                            console.error(`[Recorder] Error stopping track:`, err);
                        }
                    });
                }
            };

        stopTracks(this.screenStream);
        stopTracks(this.audioStream);
        stopTracks(this.combinedStream);

        // Clear references
        this.screenStream = null;
        this.audioStream = null;
        this.combinedStream = null;
        this.recordedChunks = [];
        this.selectedSource = null;
        this.isRecording = false;
        console.log('[Recorder] Cleanup completed');
    }    saveRecording(blob) {
        console.log('[Recorder] Saving recording, blob size:', blob.size);
        try {
            // Check if we should save the file
            const keepFilesCheckbox = document.querySelector('input[type="checkbox"]');
            if (!keepFilesCheckbox || keepFilesCheckbox.checked) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `recording-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    this.showNotification('Recording saved!');
                    console.log('[Recorder] Recording saved successfully');
                }, 100);
            } else {
                console.log('[Recorder] File not saved as per user preference');
                this.showNotification('Recording completed! (File not saved)');
            }
        } catch (err) {
            console.error('[Recorder] Error saving recording:', err);
            this.showNotification('Error saving recording!');
        }
    }

    showNotification(message) {
        const notif = document.createElement('div');
        notif.textContent = message;
        notif.style.position = 'fixed';
        notif.style.bottom = '32px';
        notif.style.left = '50%';
        notif.style.transform = 'translateX(-50%)';
        notif.style.background = '#1de9b6';
        notif.style.color = '#232323';
        notif.style.fontWeight = 'bold';
        notif.style.padding = '0.7em 2em';
        notif.style.borderRadius = '1.5em';
        notif.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)';
        notif.style.zIndex = 99999;
        notif.style.fontSize = '1.1em';
        notif.style.animation = 'fadeInUp 0.3s ease-out';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'fadeOutDown 0.3s ease-in forwards';
            setTimeout(() => {
                document.body.removeChild(notif);
                document.head.removeChild(style);
            }, 300);
        }, 3000);
    }
}
