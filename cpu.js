class Void3CPU {
    constructor(memory) {
        this.memory = memory;
        // 27 Registers: T0-T26
        // T25 = Stack Pointer, T26 = Status Register
        this.regs = new Int32Array(27); 
        this.pc = 531441; // Code start (3^12)
        this.regs[25] = 1594322; // Stack starts at end of memory
        this.halted = false;
    }

    // Decode trits at address into a base-10 integer
    decode(addr, length) {
        let val = 0;
        for (let i = 0; i < length; i++) {
            val += (this.memory[addr + i] || 0) * Math.pow(3, i);
        }
        return val;
    }

    step() {
        if (this.halted) return;
        
        // Each instruction is 15 trits: [OP: 3][A1: 6][A2: 6]
        const op = this.decode(this.pc, 3);
        const a1 = this.decode(this.pc + 3, 6);
        const a2 = this.decode(this.pc + 9, 6);

        switch (op) {
            case 0:  this.halted = true; break; // SLP / HALT
            
            // --- Arithmetic ---
            case 1:  this.regs[a1 % 27] += this.regs[a2 % 27]; break; // ADD
            case 2:  this.regs[a1 % 27] -= this.regs[a2 % 27]; break; // SUB
            case 3:  this.regs[a1 % 27] *= this.regs[a2 % 27]; break; // MUL
            case 4:  this.regs[a1 % 27] = Math.floor(this.regs[a1 % 27] / (this.regs[a2 % 27] || 1)); break; // DIV

            // --- Balanced Logic (Tritwise) ---
            case 5:  this.regs[a1 % 27] = Math.min(this.regs[a1 % 27], this.regs[a2 % 27]); break; // MIN (AND)
            case 6:  this.regs[a1 % 27] = Math.max(this.regs[a1 % 27], this.regs[a2 % 27]); break; // MAX (OR)
            
            // --- The Balanced Comparison (The Rule Maker) ---
            case 7:  // TRI: 1 (True), -1 (False), 0 (Null/Equal)
                let diff = this.regs[a1 % 27] - this.regs[a2 % 27];
                if (diff > 0) this.regs[26] = 1;
                else if (diff < 0) this.regs[26] = -1;
                else this.regs[26] = 0;
                break;

            // --- Flow Control ---
            case 8:  this.pc = a1 - 15; break; // JMP
            case 9:  if (this.regs[26] === 0)  this.pc = a1 - 15; break; // BRZ (Branch Null/Zero)
            case 10: if (this.regs[26] === 1)  this.pc = a1 - 15; break; // BRP (Branch True/Pos)
            case 11: if (this.regs[26] === -1) this.pc = a1 - 15; break; // BRN (Branch False/Neg)

            // --- Data Movement ---
            case 12: this.regs[a1 % 27] *= 3; break; // TSL (Trit Shift Left)
            case 13: this.regs[a1 % 27] = Math.floor(this.regs[a1 % 27] / 3); break; // TSR (Trit Shift Right)
            case 14: this.regs[a1 % 27] = a2; break; // WAK (Load Immediate)
            case 17: this.regs[a1 % 27] = this.regs[a2 % 27]; break; // CPY (Register Copy)

            // --- Memory Pointers (The C-Bridge) ---
            case 15: // LOD: T[a1] = Memory[ T[a2] ]
                this.regs[a1 % 27] = this.memory[this.regs[a2 % 27]]; break;
            case 16: // STR: Memory[ T[a2] ] = T[a1]
                this.memory[this.regs[a2 % 27]] = this.regs[a1 % 27]; break;

            // --- Hardware Blitter ---
            case 20: this.drawRect(); break; // RECT
        }
        
        this.pc += 15;
    }

    drawRect() {
        // GPU Registers: T0=R, T1=G, T2=B, T3=X, T4=Y, T5=W, T6=H
        let r=this.regs[0], g=this.regs[1], b=this.regs[2];
        let xS=this.regs[3], yS=this.regs[4], w=this.regs[5], h=this.regs[6];

        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                let x = xS + j, y = yS + i;
                if (x >= 0 && x < 243 && y >= 0 && y < 243) {
                    let addr = (y * 243 + x) * 9;
                    // Write Color trits
                    for(let k=0; k<3; k++) {
                        this.memory[addr+k] = Math.floor(r / Math.pow(3, k)) % 3;
                        this.memory[addr+3+k] = Math.floor(g / Math.pow(3, k)) % 3;
                        this.memory[addr+6+k] = Math.floor(b / Math.pow(3, k)) % 3;
                    }
                }
            }
        }
    }
}

module.exports = Void3CPU;