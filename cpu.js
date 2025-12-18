const fs = require('fs');

class Void3CPU {
    constructor(memory) {
        this.memory = memory;
        this.regs = new Int32Array(27); // T0-T26
        this.pc = 531441; // Start code after VRAM (3^12)
        this.halted = false;
    }

    // Decodes trits vertically from memory
    decode(addr, length) {
        let val = 0;
        for (let i = 0; i < length; i++) {
            val += (this.memory[addr + i] || 0) * Math.pow(3, i);
        }
        return val;
    }

    step() {
        if (this.halted) return;

        const op = this.decode(this.pc, 3);      
        const a1 = this.decode(this.pc + 3, 6);  
        const a2 = this.decode(this.pc + 9, 6);  

        switch (op) {
            case 0:  this.halted = true; break; // SLP
            case 1:  this.regs[a1 % 27] += this.regs[a2 % 27]; break; // ADD
            case 2:  this.regs[a1 % 27] -= this.regs[a2 % 27]; break; // SUB
            case 5:  this.pc = this.decode(this.pc + 3, 12) - 15; break; // JMP
            case 6:  this.memory.fill(a1 % 3, 0, 531441); break; // CLS
            case 13: this.regs[a1 % 27] = a2; break; // WAK
            case 15: this.drawRect(); break; // RECT
        }
        this.pc += 15; // Vertical jump to next instruction block
    }

    drawRect() {
        // T0,1,2=RGB | T3,4=XY | T5,6=WH
        let r=this.regs[0], g=this.regs[1], b=this.regs[2];
        let xS=this.regs[3], yS=this.regs[4], w=this.regs[5], h=this.regs[6];
        
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                let x = xS + j; let y = yS + i;
                if (x >= 0 && x < 243 && y >= 0 && y < 243) {
                    let addr = (y * 243 + x) * 9;
                    this.writeTritColor(addr, r, g, b);
                }
            }
        }
    }

    writeTritColor(addr, r, g, b) {
        for(let i=0; i<3; i++) {
            this.memory[addr+i] = Math.floor(r / Math.pow(3, i)) % 3;
            this.memory[addr+3+i] = Math.floor(g / Math.pow(3, i)) % 3;
            this.memory[addr+6+i] = Math.floor(b / Math.pow(3, i)) % 3;
        }
    }
}

module.exports = Void3CPU;