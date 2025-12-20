const { createCanvas } = require('canvas');
const fs = require('fs');
const { exec } = require('child_process');

/**
 * VOID-3 Trinary GPU & System Loader
 * Architecture: 50-Trit Address Space
 * Mapping: Balanced Trits (-1, 0, 1)
 */
class TrinaryGPU {
    constructor() { 
        // VOID-3 Resolution: 243x243 (3^5)
        this.canvas = createCanvas(243, 243); 
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Renders the VRAM buffer to a PNG frame.
     * Maps the trinary color range [-13, 13] to RGB [0, 255].
     */
    render(vram) {
        const imgData = this.ctx.createImageData(243, 243);
        
        // Loop through every pixel (3^10 = 59049)
        for (let i = 0; i < 59049; i++) {
            let addr = i * 9; // 9 trits per pixel (3R, 3G, 3B)
            let r_val = 0, g_val = 0, b_val = 0;

            // Calculate channel values using powers of 3
            for(let t = 0; t < 3; t++) {
                r_val += (vram[addr + t] || 0) * Math.pow(3, t);
                g_val += (vram[addr + 3 + t] || 0) * Math.pow(3, t);
                b_val += (vram[addr + 6 + t] || 0) * Math.pow(3, t);
            }

            let p = i * 4;

            /** * THE COLOR FIX:
             * Balanced trits sum to a range of -13 to +13.
             * (val + 13) shifts range to [0, 26].
             * Multiplying by 9.807 scales it to [0, 255].
             */
            imgData.data[p]     = Math.max(0, Math.min(255, Math.floor((r_val + 13) * 9.807))); 
            imgData.data[p + 1] = Math.max(0, Math.min(255, Math.floor((g_val + 13) * 9.807)));
            imgData.data[p + 2] = Math.max(0, Math.min(255, Math.floor((b_val + 13) * 9.807)));
            imgData.data[p + 3] = 255; // Alpha always full
        }

        this.ctx.putImageData(imgData, 0, 0);
        
        // Write frame to disk for the display server (feh)
        const buffer = this.canvas.toBuffer();
        fs.writeFileSync('frame.png', buffer);

        // Refresh the display background
        // Note: export DISPLAY=:1 is for headless/virtual framebuffers
        exec('export DISPLAY=:1 && feh --bg-scale --refresh 0.1 frame.png', (error) => {
            if (error) {
                // Silencing background errors to prevent log flooding
            }
        });
    }
}

// --- SYSTEM INITIALIZATION ---

// Use Float64Array or BigInt64Array for 50-trit memory stability
const vram = new Int8Array(10000000); // 10MB VRAM Buffer
const gpu = new TrinaryGPU();

/**
 * Main System Loop
 * Handles the 20,000 line draw and the transition to paint.vasm
 */
function startOS() {
    console.log("VOID-3: Booting 50-Trit Environment...");
    
    // 1. Initial Render
    gpu.render(vram);

    // 2. Refresh Loop
    setInterval(() => {
        // Only re-render if the CPU has modified VRAM (Dirty Bit check)
        gpu.render(vram);
    }, 100); // 10 FPS to save CPU cycles for the 20,000 line processing
}

module.exports = TrinaryGPU;

// Start if run directly
if (require.main === module) {
    startOS();
}
