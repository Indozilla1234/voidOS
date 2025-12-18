const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');
const readline = require('readline');

// Initialize Memory (3^11 = 177,147 trits)
const memory = new Int8Array(177147);
const gpu = new TrinaryGPU(243, 243);
const cpu = new Void3CPU(memory);

// BIOS Instruction Mapping
const OPMAP = { "SLP": 0, "CLS": 6, "WAK": 13, "RECT": 15 };

/**
 * Enhanced Trinary Writer
 * Now handles larger numbers (like 243) by using more trits.
 */
function writeTryte(value, address) {
    let val = Math.floor(Math.abs(value));
    // We fill 6 trits per argument to allow values up to 728 (3^6 - 1)
    for (let i = 0; i < 6; i++) {
        memory[address + i] = val % 3;
        val = Math.floor(val / 3);
    }
}

function loadProgram(filename) {
    try {
        const code = fs.readFileSync(filename, 'utf8')
            .split('\n')
            .filter(l => l.trim() && !l.startsWith('//'));

        let addr = 59049; // Standard Entry Point
        code.forEach(line => {
            const [op, a1, a2] = line.trim().split(/\s+/);
            
            // Write Op-code (Uses 3 trits)
            let opVal = OPMAP[op] || 0;
            memory[addr] = opVal % 3;
            memory[addr + 1] = Math.floor(opVal / 3) % 3;
            memory[addr + 2] = Math.floor(opVal / 9) % 3;

            // Write Arguments (Uses 6 trits each for higher precision)
            writeTryte(parseInt(a1) || 0, addr + 3);
            writeTryte(parseInt(a2) || 0, addr + 9);
            
            addr += 15; // Instruction width expanded to 15 trits for accuracy
        });
        console.log(`BIOS: ${filename} loaded.`);
    } catch (e) {
        console.error("BIOS Error:", e.message);
    }
}

// Keyboard Input
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', (s, k) => {
    if (k && k.ctrl && k.name === 'c') process.exit();
    const ports = { 'w': 177141, 'a': 177142, 's': 177143, 'd': 177144 };
    if (k && ports[k.name]) memory[ports[k.name]] = 1;
});

loadProgram(process.argv[2] || 'os.vasm');

// Main Execution Loop
setInterval(() => {
    // Run 500 steps per frame for smooth rendering
    for(let i=0; i<500; i++) cpu.step(); 
    
    gpu.render(memory.slice(0, 59049));
    
    // Clear input ports
    [177141, 177142, 177143, 177144].forEach(p => memory[p] = 0);
    
    process.stdout.write(`\r[VOID-3] PC: ${cpu.pc} | X: ${cpu.regs[1]} | Y: ${cpu.regs[2]}`);
}, 100);