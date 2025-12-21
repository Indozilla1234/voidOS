/**
 * VOID-3 TRANSCENDENT CPU - v2.5 (Launcher & I/O Fixed)
 * Optimized for Balanced Ternary Operations & Persistent Mouse Polling
 */

class Void3CPU {
    constructor(memoryBuffer) {
        this.memory = memoryBuffer;
        // 27 Registers (Balanced Trinary -1, 0, 1 logic inside)
        this.regs = Array.from({ length: 27 }, () => 0n);
        
        // Boot Address (Synchronized with main.js)
        this.pc = 531441;
        this.sp = 1594322;
        this.regs[25] = BigInt(this.sp);
        
        this.halted = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseClicked = 0;
        this.keys = {};
        
        // 50-Trit Limits
        this.TRIT_LIMIT = 3n ** 50n;
        this.HALF_LIMIT = this.TRIT_LIMIT / 2n;
    }

    updateMouse(x, y, click) {
        this.mouseX = x;
        this.mouseY = y;
        this.mouseClicked = click;
    }

    updateKey(keyCode, isPressed) {
        this.keys[keyCode] = isPressed ? 1 : 0;
    }

    // Ensures numbers stay within the 50-trit "Balanced" range
    clamp(val) {
        let res = val % this.TRIT_LIMIT;
        if (res > this.HALF_LIMIT) res -= this.TRIT_LIMIT;
        if (res < -this.HALF_LIMIT) res += this.TRIT_LIMIT;
        return res;
    }

    decode(addr, length) {
        let val = 0n;
        for (let i = 0; i < length; i++) {
            let trit = BigInt(this.memory[addr + i] || 0);
            val += trit * (3n ** BigInt(i));
        }
        return val;
    }

    encode(addr, length, value) {
        let temp = value;
        for (let i = 0; i < length; i++) {
            let trit = Number(((temp + 1n) % 3n) - 1n);
            this.memory[addr + i] = trit;
            temp = (temp - BigInt(trit)) / 3n;
        }
    }

    step() {
        if (this.halted) return;

        const op = Number(this.decode(this.pc, 4));
        const a1 = Number(this.decode(this.pc + 4, 5)) % 27;
        const a2Val = this.decode(this.pc + 9, 6);

        switch (op) {
            case 0:  this.halted = true; break;
            
            // Arithmetic
            case 1:  this.regs[a1] = this.clamp(this.regs[a1] + this.regs[Number(a2Val) % 27]); break;
            case 2:  this.regs[a1] = this.clamp(this.regs[a1] - this.regs[Number(a2Val) % 27]); break;
            case 3:  this.regs[a1] = this.clamp(this.regs[a1] * this.regs[Number(a2Val) % 27]); break;
            
            // Data Movement
            case 11: this.regs[a1] = this.clamp(a2Val); break;
            case 12: this.regs[a1] = this.regs[Number(a2Val) % 27]; break;

            // Flow Control
            case 20: // JMP
                this.pc = Number(a2Val); 
                return; 

            case 21: // BRN (Branch if Negative)
                if (this.regs[a1] < 0n) { this.pc = Number(a2Val); return; }
                break;
            case 22: // BRP (Branch if Positive)
                if (this.regs[a1] > 0n) { this.pc = Number(a2Val); return; }
                break;

            case 23: // TRI (Trinary Comparison)
                let v1 = this.regs[a1];
                let v2 = this.regs[Number(a2Val) % 27];
                if (v1 < v2) this.regs[a1] = -1n;
                else if (v1 > v2) this.regs[a1] = 1n;
                else this.regs[a1] = 0n;
                break;

            // Graphics
            case 30: this.drawRect(); break;

            // Hardware I/O (FIXED FOR LAUNCHER)
            case 31: // WAK (Hardware Poll)
                if (a2Val === 0n)      this.regs[a1] = BigInt(this.mouseX);
                else if (a2Val === 1n) this.regs[a1] = BigInt(this.mouseY);
                else if (a2Val === 2n) this.regs[a1] = BigInt(this.mouseClicked);
                break;

            case 32: // KEY 
                let kCode = Number(a2Val);
                let isDown = this.keys[kCode] === 1;
                this.regs[a1] = isDown ? 13n : 0n;
                break;
            
            case 45: this.halted = true; break;
        }

        this.pc += 15;
    }

    drawRect() {
        const r = this.regs[0];
        const g = this.regs[1];
        const b = this.regs[2];
        const x = Number(this.regs[3]);
        const y = Number(this.regs[4]);
        const w = Number(this.regs[5]);
        const h = Number(this.regs[6]);

        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                let tx = x + i;
                let ty = y + j;
                // Bound check for the 243x243 Trinary Display
                if (tx >= 0 && tx < 243 && ty >= 0 && ty < 243) {
                    let addr = (ty * 243 + tx) * 9;
                    this.encode(addr, 3, r);
                    this.encode(addr + 3, 3, g);
                    this.encode(addr + 6, 3, b);
                }
            }
        }
    }
}

module.exports = Void3CPU;
