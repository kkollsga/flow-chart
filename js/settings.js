// --- Settings Manager ---
class SettingsManager {
    constructor(diagramManager) {
        this.diagramManager = diagramManager; // Store reference to diagram manager
        this.settings = {
            textScale: 1.0
        };
        this.loadSettings();
    }
    
    loadSettings() {
        try {
            const storedSettings = localStorage.getItem('markdownDiagramSettings');
            if (storedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(storedSettings) };
            }
            this.applySettings();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    applySettings() {
        // Apply text scale
        document.documentElement.style.setProperty('--font-scale', this.settings.textScale);
        
        // Update UI if elements exist
        const textScaleValue = document.getElementById('text-scale-value');
        
        if (textScaleValue) textScaleValue.textContent = `${this.settings.textScale.toFixed(2)}x`;
        
        // Update all box sizes when settings are applied (e.g. on page load)
        if (this.diagramManager) {
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
                this.diagramManager.updateAllBoxSizes();
            }, 100);
        }
    }
}
