// Audio input device management
class AudioInputManager {
    constructor() {
        this.audioDevices = [];
        this.selectedDeviceId = '';
        this.isListening = false;
        
        // UI Elements
        this.btnEl = document.getElementById('audioInputBtn');
        this.labelEl = document.getElementById('audioInputLabel');
        this.badgeEl = document.getElementById('audioInputBadge');
        this.dropdownEl = document.getElementById('audioInputDropdown');
        
        // Bind methods
        this.handleDeviceChange = this.handleDeviceChange.bind(this);
        this.toggleDropdown = this.toggleDropdown.bind(this);
        this.positionDropdown = this.positionDropdown.bind(this);
        this.handleOutsideClick = this.handleOutsideClick.bind(this);
        
        // Initialize
        this.initialize();
    }
    
    async initialize() {
        try {
            // Get initial permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            
            // Start device monitoring
            await this.refreshDevices();
            this.startDeviceMonitoring();
            
            // Set up UI event listeners
            this.setupUIHandlers();
            
        } catch (err) {
            console.error('[AudioInput] Init error:', err);
            this.setErrorState('Access denied');
        }
    }
    
    async refreshDevices() {
        try {
            this.audioDevices = (await navigator.mediaDevices.enumerateDevices())
                .filter(d => d.kind === 'audioinput');
                
            this.updateDeviceList();
            
            if (this.audioDevices.length === 0) {
                this.setErrorState('No mic found');
                return;
            }
            
            // Keep current selection if still available
            if (this.selectedDeviceId) {
                const deviceExists = this.audioDevices.some(d => d.deviceId === this.selectedDeviceId);
                if (!deviceExists) {
                    this.selectedDeviceId = this.audioDevices[0].deviceId;
                    this.updateUIState(this.audioDevices[0]);
                }
            } else {
                // Select first device by default
                this.selectedDeviceId = this.audioDevices[0].deviceId;
                this.updateUIState(this.audioDevices[0]);
            }
        } catch (err) {
            console.error('[AudioInput] Refresh error:', err);
            this.setErrorState('Device error');
        }
    }
    
    updateDeviceList() {
        if (!this.dropdownEl) return;
        
        this.dropdownEl.innerHTML = '';
        
        this.audioDevices.forEach((device, idx) => {
            const opt = document.createElement('div');
            opt.textContent = device.label || `Microphone ${idx + 1}`;
            opt.title = device.label || `Microphone ${idx + 1}`;            opt.style.padding = '0.5em 1em';
            opt.style.cursor = 'pointer';
            opt.style.color = '#fff';
            opt.style.fontSize = '0.85em';
            opt.style.borderBottom = idx < this.audioDevices.length-1 ? '1px solid #333' : 'none';
            opt.style.whiteSpace = 'nowrap';
            opt.style.overflow = 'hidden';
            opt.style.textOverflow = 'ellipsis';
            
            // Show selection state
            if (device.deviceId === this.selectedDeviceId) {
                opt.style.background = 'rgba(29, 233, 182, 0.1)';
                opt.style.color = '#1de9b6';
            }
            
            // Hover effects
            opt.onmouseenter = () => {
                opt.style.background = device.deviceId === this.selectedDeviceId 
                    ? 'rgba(29, 233, 182, 0.15)' 
                    : '#333';
            };
            
            opt.onmouseleave = () => {
                opt.style.background = device.deviceId === this.selectedDeviceId 
                    ? 'rgba(29, 233, 182, 0.1)' 
                    : 'transparent';
            };
            
            // Click handler
            opt.onclick = (e) => {
                e.stopPropagation();
                this.selectDevice(device);
                this.dropdownEl.style.display = 'none';
            };
            
            this.dropdownEl.appendChild(opt);
        });
    }
    
    selectDevice(device) {
        this.selectedDeviceId = device.deviceId;
        this.updateUIState(device);
    }
    
    updateUIState(device) {
        if (!this.labelEl || !this.badgeEl) return;
        
        this.labelEl.textContent = device.label || 'Default Microphone';
        this.badgeEl.textContent = 'On';
        this.badgeEl.style.background = '#27ae60';
        
        if (this.btnEl) {
            this.btnEl.style.opacity = '1';
            this.btnEl.style.pointerEvents = 'auto';
        }
        
        // Update dropdown selection state
        if (this.dropdownEl) {
            this.dropdownEl.querySelectorAll('div').forEach(opt => {
                if (opt.textContent === device.label) {
                    opt.style.background = 'rgba(29, 233, 182, 0.1)';
                    opt.style.color = '#1de9b6';
                } else {
                    opt.style.background = 'transparent';
                    opt.style.color = '#fff';
                }
            });
        }
    }
    
    setErrorState(message) {
        if (!this.labelEl || !this.badgeEl) return;
        
        this.labelEl.textContent = message;
        this.badgeEl.textContent = 'Error';
        this.badgeEl.style.background = '#e74c3c';
        
        if (this.btnEl) {
            this.btnEl.style.opacity = '0.7';
            this.btnEl.style.pointerEvents = 'none';
        }
        
        this.selectedDeviceId = '';
        if (this.dropdownEl) {
            this.dropdownEl.innerHTML = '';
        }
    }
    
    startDeviceMonitoring() {
        if (this.isListening) return;
        navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange);
        this.isListening = true;
    }
    
    stopDeviceMonitoring() {
        if (!this.isListening) return;
        navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange);
        this.isListening = false;
    }
    
    async handleDeviceChange() {
        await this.refreshDevices();
    }
    
    setupUIHandlers() {
        if (this.btnEl) {
            this.btnEl.addEventListener('click', this.toggleDropdown);
        }
        
        document.body.addEventListener('click', this.handleOutsideClick);
        window.addEventListener('resize', () => {
            if (this.dropdownEl && this.dropdownEl.style.display === 'block') {
                this.positionDropdown();
            }
        });
    }
    
    toggleDropdown(e) {
        e.stopPropagation();
        if (!this.dropdownEl) return;
        
        if (this.dropdownEl.style.display === 'block') {
            this.dropdownEl.style.display = 'none';
        } else {
            this.positionDropdown();
        }
    }    positionDropdown() {
        if (!this.btnEl || !this.dropdownEl) return;
        
        console.log('[AudioInput] Positioning dropdown - btnEl:', this.btnEl.id, 'dropdownEl:', this.dropdownEl.id);
        
        // Make absolutely sure the dropdown is visible and correctly positioned
        this.dropdownEl.style.display = 'block';
        this.dropdownEl.style.visibility = 'visible';
        this.dropdownEl.style.opacity = '1';
        this.dropdownEl.style.position = 'fixed'; // Use fixed positioning instead of absolute
        
        // Position in center of screen for better visibility during debugging
        const rect = this.btnEl.getBoundingClientRect();
        this.dropdownEl.style.top = (rect.top - 190) + 'px'; // Position above button with fixed distance
        this.dropdownEl.style.left = (rect.left + (rect.width/2)) + 'px';
        this.dropdownEl.style.transform = 'translateX(-50%)';
        
        // Ensure it's on top of everything
        this.dropdownEl.style.maxHeight = '180px';
        this.dropdownEl.style.width = '280px';
        this.dropdownEl.style.zIndex = '10000'; // Higher z-index
        this.dropdownEl.style.backgroundColor = '#232323'; // Ensure background is visible
        this.dropdownEl.style.border = '2px solid #1de9b6';
        this.dropdownEl.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        
        console.log('[AudioInput] Dropdown positioned at:', 
            'top:', this.dropdownEl.style.top,
            'left:', this.dropdownEl.style.left,
            'z-index:', this.dropdownEl.style.zIndex);
    }
    
    handleOutsideClick(e) {
        if (this.dropdownEl && 
            this.dropdownEl.style.display === 'block' && 
            !this.dropdownEl.contains(e.target) && 
            !this.btnEl.contains(e.target)) {
            this.dropdownEl.style.display = 'none';
        }
    }
    
    getCurrentDeviceId() {
        return this.selectedDeviceId;
    }
    
    cleanup() {
        this.stopDeviceMonitoring();
        document.body.removeEventListener('click', this.handleOutsideClick);
        
        if (this.btnEl) {
            this.btnEl.removeEventListener('click', this.toggleDropdown);
        }
    }
}

// Export singleton instance
window.audioInputManager = new AudioInputManager();
