// Main recorder script
document.addEventListener('DOMContentLoaded', () => {
    const recorder = new ScreenRecorder();
    let selectedAudioDeviceId = '';
    let webcamEnabled = true;    // Handle webcam toggle - find whichever toggle exists for compatibility
    const webcamToggle = document.getElementById('webcamToggle') || document.getElementById('enableWebcamToggle');
    if (webcamToggle) {
        webcamToggle.addEventListener('change', () => {
            webcamEnabled = webcamToggle.checked;
            // Use either API pattern that's available
            if (window.electronWindow && window.electronWindow.toggleWebcam) {
                window.electronWindow.toggleWebcam(webcamEnabled);
            } else if (window.electronAPI && window.electronAPI.toggleWebcam) {
                window.electronAPI.toggleWebcam(webcamEnabled);
            }
            
            // Enable/disable webcam related controls
            const blurToggle = document.getElementById('blurBgToggle');
            const bgControls = document.querySelector('.control-section');
            if (blurToggle && bgControls) {
                blurToggle.disabled = !webcamEnabled;
                bgControls.style.opacity = webcamEnabled ? '1' : '0.5';
            }
        });
    }

    // Start button click - Select screen and start recording
    document.getElementById('recordBtn').onclick = async function() {
        try {
            // Hide start button and show loading state
            this.style.display = 'none';
            
            // Select screen and start recording immediately
            await recorder.selectAndStartRecording(selectedAudioDeviceId, (elapsed) => {
                const progressBar = document.getElementById('record-progress');
                const progressLabel = document.getElementById('record-progress-label');
                if (progressBar) progressBar.value = Math.min(100, elapsed * 2);
                if (progressLabel) progressLabel.textContent = `Recording... ${elapsed}s`;
            });

            // Show stop button and hide selection UI
            document.getElementById('stopBtn').style.display = 'inline';
            
            // Notify main process
            window.electronWindow.startRecording();
            window.electronWindow.hide();

            // Show progress UI
            showProgressUI();
        } catch (err) {
            console.error('[Renderer] Error:', err);
            if (err.message !== 'Selection cancelled') {
                alert('Error: ' + err.message);
            }
            // Reset UI
            this.style.display = 'inline';
        }
    };

    // Stop button click
    document.getElementById('stopBtn').onclick = function() {
        recorder.stopRecording();
        
        // Reset UI
        this.style.display = 'none';
        document.getElementById('recordBtn').style.display = 'inline';
        
        // Clean up
        hideProgressUI();
        window.electronWindow.stopRecording();
        window.electronWindow.show();
    };

    // Audio device selection
    populateAudioInputs().then(defaultDeviceId => {
        selectedAudioDeviceId = defaultDeviceId;
    });

    // Listen for tray stop recording
    if (window.electronAPI) {
        window.electronAPI.onTrayStopRecording(() => {
            const stopBtn = document.getElementById('stopBtn');
            if (stopBtn && stopBtn.style.display !== 'none') {
                stopBtn.click();
            }
        });
    }
});
