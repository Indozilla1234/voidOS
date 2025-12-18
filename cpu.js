class Void3CPU {
    constructor(memory) {
        this.memory = memory;
        this.regs = new Int32Array(9); // T0-T8
        this.pc = 59049; // Standard Code Entry Point
        this.halted = false;
    }

    /**
     * Flexible Trinary Decoder
     * Decodes a sequence of trits into a decimal number.
     * length 3 = max 26 | length 6 = max 728
     */
    decode(addr, length) {
        let val = 0;
        for (let i = 0; i < length; i++) {
            // Little-endian: t1 + (t2 * 3) + (t3 * 9) ...
            val += (this.memory[addr + i] || 0) * Math.pow(3, i);
        }
        return val;
    }

    step() {
        if (this.halted) return;

        // FETCH: New 15-trit instruction format
        // [OP: 3 trits] [ARG1: 6 trits] [ARG2: 6 trits]
        const op = this.decode(this.pc, 3);      
        const a1 = this.decode(this.pc + 3, 6);  
        const a2 = this.decode(this.pc + 9, 6);  

        // EXECUTE
        switch (op) {
            case 13: // WAK: Write value to register
                this.regs[a1 % 9] = a2; 
                break; 

            case 6: // CLS: Clear Screen
                // Interpret 2 as Blue (-1 in the GPU)
                let fillVal = (a1 === 2) ? -1 : a1;
                this.memory.fill(fillVal, 0, 59049); 
                break; 

            case 15: // RECT: Draw rectangle (Color: T0, X: T1, Y: T2, W: T3, H: T4)
                let xStart = this.regs[1];
                let yStart = this.regs[2];
                let width = this.regs[3];
                let height = this.regs[4];
                
                for (let i = 0; i < height; i++) {
                    for (let j = 0; j < width; j++) {
                        let x = xStart + j;
                        let y = yStart + i;
                        
                        // Hard Boundary Check to prevent "C" wrapping
                        if (x >= 0 && x < 243 && y >= 0 && y < 243) {
                            this.memory[y * 243 + x] = this.regs[0];
                        }
                    }
                }
                break;

            case 0: // SLP: Halt system
                this.halted = true; 
                break;
        }

        // Increment PC by the new instruction width (15)
        this.pc += 15;
    }
}

module.exports = Void3CPU;