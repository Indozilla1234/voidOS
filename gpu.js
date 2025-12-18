const { createCanvas } = require('canvas');
const fs = require('fs');
const { exec } = require('child_process');

class TrinaryGPU {
    constructor() { 
        this.canvas = createCanvas(243, 243); 
        this.ctx = this.canvas.getContext('2d');
    }

    render(vram) {
        const imgData = this.ctx.createImageData(243, 243);
        for (let i = 0; i < 59049; i++) {
            let addr = i * 9;
            let r = 0, g = 0, b = 0;
            for(let t=0; t<3; t++) {
                r += (vram[addr+t] || 0) * Math.pow(3, t);
                g += (vram[addr+3+t] || 0) * Math.pow(3, t);
                b += (vram[addr+6+t] || 0) * Math.pow(3, t);
            }
            let p = i * 4;
            imgData.data[p] = Math.min(255, r * 9.8);
            imgData.data[p+1] = Math.min(255, g * 9.8);
            imgData.data[p+2] = Math.min(255, b * 9.8);
            imgData.data[p+3] = 255;
        }
        this.ctx.putImageData(imgData, 0, 0);
        fs.writeFileSync('frame.png', this.canvas.toBuffer());
        exec('export DISPLAY=:1 && feh --bg-scale --refresh 0.1 frame.png');
    }
}

module.exports = TrinaryGPU;