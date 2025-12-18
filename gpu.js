const { createCanvas } = require('canvas');
const fs = require('fs');
const { exec } = require('child_process');

class TrinaryGPU {
    constructor(width = 243, height = 243) { 
        this.width = width;
        this.height = height;
        this.canvas = createCanvas(width, height); 
        this.ctx = this.canvas.getContext('2d');
        this.colors = { '-1': 'blue', '0': 'black', '1': 'red' };
    }

    render(vram) {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.width, this.height);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const trit = vram[y * this.width + x];
                if (trit !== 0) {
                    this.ctx.fillStyle = this.colors[trit] || 'black';
                    this.ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        
        // Save and force refresh
        const buffer = this.canvas.toBuffer('image/png');
        fs.writeFileSync('frame.png', buffer);
        exec('export DISPLAY=:1 && feh --bg-scale --refresh 0.1 frame.png');
    }
}
module.exports = TrinaryGPU;