/**
 * VOID-3 TRANSCENDENT CPU
 * Architecture: Balanced Ternary
 * Word Size: 50 Trits (~79-bit precision)
 * Instruction Format: 15 Trits [4: OP][5: ARG1][6: ARG2]
 */

class Void3CPU {
    constructor(memoryBuffer) {
        this.memory = memoryBuffer;
        
        // 27 General Purpose Registers (T0-T26) as BigInts
        this.regs = Array.from({ length: 27 }, () => 0n);
        
        this.pc = 531441;           // Program Counter (3^12)
        this.sp = 1594322;          // Stack Pointer at end of memory
        this.regs[25] = BigInt(this.sp);
        
        this.halted = false;
        
        // 50-Trit Constants
        this.TRIT_LIMIT = 3n ** 50n;
        this.HALF_LIMIT = this.TRIT_LIMIT / 2n;
    }

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

        // Fetch 15-trit instruction
        const op = Number(this.decode(this.pc, 4));
        const a1 = Number(this.decode(this.pc + 4, 5)) % 27;
        const a2Val = this.decode(this.pc + 9, 6);

        switch (op) {
            case 0:  this.halted = true; break;
            
            // Arithmetic
            case 1:  this.regs[a1] = this.clamp(this.regs[a1] + this.regs[Number(a2Val) % 27]); break; 
            case 2:  this.regs[a1] = this.clamp(this.regs[a1] - this.regs[Number(a2Val) % 27]); break; 
            case 3:  this.regs[a1] = this.clamp(this.regs[a1] * this.regs[Number(a2Val) % 27]); break; 
            case 4:  
                let divisor = this.regs[Number(a2Val) % 27];
                this.regs[a1] = divisor !== 0n ? this.clamp(this.regs[a1] / divisor) : 0n; 
                break; 
            case 6:  this.regs[a1] = -this.regs[a1]; break; 

            // Movement
            case 11: this.regs[a1] = this.clamp(a2Val); break; // SET
            case 12: this.regs[a1] = this.regs[Number(a2Val) % 27]; break; // CPY

            // Flow
            case 20: this.pc = Number(a2Val) - 15; break; // JMP
            case 24: // CAL
                this.encode(Number(this.regs[25]), 15, BigInt(this.pc + 15));
                this.regs[25] -= 15n;
                this.pc = Number(a2Val) - 15;
                break;

            // Hardware
            case 30: this.drawRect(); break; 
            case 40: console.log(`VOID_OUT [T${a1}]:`, this.regs[a1].toString()); break; 
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
                let targetX = x + i;
                let targetY = y + j;

                if (targetX >= 0 && targetX < 243 && targetY >= 0 && targetY < 243) {
                    let addr = (targetY * 243 + targetX) * 9;
                    this.encode(addr, 3, r);
                    this.encode(addr + 3, 3, g);
                    this.encode(addr + 6, 3, b);
                }
            }
        }
    }
}

module.exports = Void3CPU;